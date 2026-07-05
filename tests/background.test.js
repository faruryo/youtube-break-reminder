// background.js Unit Tests

// Chrome APIs Mocking
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  action: {
    setBadgeText: jest.fn().mockResolvedValue(undefined),
    setBadgeBackgroundColor: jest.fn().mockResolvedValue(undefined)
  },
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() }
  }
};

const background = require('../background');

describe('YouTube Break Reminder - background.js Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getBusinessDateString() - Custom Reset Hour Logic', () => {
    it('should return current date when time is exactly at the reset hour (e.g. 04:00)', () => {
      // 2026-07-05 04:00:00 JST
      const mockDate = new Date('2026-07-05T04:00:00+09:00');
      jest.setSystemTime(mockDate);

      const businessDate = background.getBusinessDateString(4);
      expect(businessDate).toBe('2026-07-05');
    });

    it('should return yesterday\'s date when time is before the reset hour (e.g. 03:00 when reset is 04:00)', () => {
      // 2026-07-05 03:00:00 JST
      const mockDate = new Date('2026-07-05T03:00:00+09:00');
      jest.setSystemTime(mockDate);

      const businessDate = background.getBusinessDateString(4);
      expect(businessDate).toBe('2026-07-04');
    });

    it('should return current date when time is after the reset hour (e.g. 15:00 when reset is 04:00)', () => {
      // 2026-07-05 15:00:00 JST
      const mockDate = new Date('2026-07-05T15:00:00+09:00');
      jest.setSystemTime(mockDate);

      const businessDate = background.getBusinessDateString(4);
      expect(businessDate).toBe('2026-07-05');
    });

    it('should default to 4 AM if no reset hour is provided', () => {
      // 2026-07-05 03:59:59 JST
      const mockDate = new Date('2026-07-05T03:59:59+09:00');
      jest.setSystemTime(mockDate);

      const businessDate = background.getBusinessDateString();
      expect(businessDate).toBe('2026-07-04');
    });
  });

  describe('checkAndResetContinuous() - Idle Reset Logic', () => {
    it('should NOT reset continuous seconds if last heartbeat was within 300 seconds', async () => {
      const now = Date.now();
      const lastHeartbeatTime = now - 290 * 1000; // 290秒前 (300秒未満)

      chrome.storage.local.get.mockResolvedValue({
        continuousSeconds: 600, // 10分
        lastHeartbeatTime: lastHeartbeatTime
      });

      jest.setSystemTime(now);

      const result = await background.checkAndResetContinuous();
      
      expect(result).toBe(600);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should reset continuous seconds to 0 if last heartbeat was more than 300 seconds ago', async () => {
      const now = Date.now();
      const lastHeartbeatTime = now - 310 * 1000; // 310秒前 (300秒超)

      chrome.storage.local.get.mockResolvedValue({
        continuousSeconds: 600, // 10分
        lastHeartbeatTime: lastHeartbeatTime
      });

      jest.setSystemTime(now);

      const result = await background.checkAndResetContinuous();
      
      expect(result).toBe(0);
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        continuousSeconds: 0,
        lastHeartbeatTime: 0
      });
    });

    it('should return 0 and NOT call set if lastHeartbeatTime is 0 (initial state)', async () => {
      chrome.storage.local.get.mockResolvedValue({
        continuousSeconds: 0,
        lastHeartbeatTime: 0
      });

      const result = await background.checkAndResetContinuous();
      
      expect(result).toBe(0);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('isHoliday() - Japanese Public Holiday Logic', () => {
    it('should return true for New Year\'s Day (元日: Jan 1)', () => {
      expect(background.isHoliday(new Date('2026-01-01T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Coming of Age Day (成人の日: 2nd Monday of Jan)', () => {
      // Jan 12, 2026 is the 2nd Monday of January
      expect(background.isHoliday(new Date('2026-01-12T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Vernal Equinox (春分の日: Mar 20 in 2026)', () => {
      expect(background.isHoliday(new Date('2026-03-20T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Showa Day (昭和の日: Apr 29)', () => {
      expect(background.isHoliday(new Date('2026-04-29T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Substitute Holiday (振替休日: May 6 in 2026)', () => {
      // In 2026: May 3 (Sun) is 憲法記念日, May 4 (Mon) is みどりの日, May 5 (Tue) is こどもの日.
      // Therefore, May 6 (Wed) is a Substitute Holiday.
      expect(background.isHoliday(new Date('2026-05-06T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Citizen\'s Holiday (国民の休日: Sep 22 in 2026)', () => {
      // In 2026: Sep 21 (Mon) is 敬老の日, Sep 23 (Wed) is 秋分の日.
      // Therefore, Sep 22 (Tue) is a Citizen's Holiday (国民の休日).
      expect(background.isHoliday(new Date('2026-09-22T12:00:00+09:00'))).toBe(true);
    });

    it('should return false for regular weekdays', () => {
      // July 6, 2026 is a Monday (not holiday)
      expect(background.isHoliday(new Date('2026-07-06T12:00:00+09:00'))).toBe(false);
    });
  });

  describe('isHolidayOrWeekend()', () => {
    it('should return true for Saturday', () => {
      // July 11, 2026 is Saturday
      expect(background.isHolidayOrWeekend(new Date('2026-07-11T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for Sunday', () => {
      // July 12, 2026 is Sunday
      expect(background.isHolidayOrWeekend(new Date('2026-07-12T12:00:00+09:00'))).toBe(true);
    });

    it('should return true for public holidays', () => {
      // Jan 1, 2026 is Thursday but New Year's Day
      expect(background.isHolidayOrWeekend(new Date('2026-01-01T12:00:00+09:00'))).toBe(true);
    });

    it('should return false for regular weekdays', () => {
      // July 6, 2026 is Monday
      expect(background.isHolidayOrWeekend(new Date('2026-07-06T12:00:00+09:00'))).toBe(false);
    });
  });

  describe('getActiveLimitKey()', () => {
    it('should return limitSeconds_H for public holidays', () => {
      expect(background.getActiveLimitKey(new Date('2026-01-01T12:00:00+09:00'))).toBe('limitSeconds_H');
    });

    it('should return limitSeconds_0 for Sunday', () => {
      expect(background.getActiveLimitKey(new Date('2026-07-12T12:00:00+09:00'))).toBe('limitSeconds_0');
    });

    it('should return limitSeconds_1 for Monday', () => {
      expect(background.getActiveLimitKey(new Date('2026-07-06T12:00:00+09:00'))).toBe('limitSeconds_1');
    });
  });

  describe('getActiveLimit()', () => {
    beforeEach(() => {
      chrome.storage.local.get.mockResolvedValue({
        limitSeconds_0: 7200, // Sun: 2h
        limitSeconds_1: 3600, // Mon: 1h
        limitSeconds_H: 9000, // Holiday: 2.5h
        resetHour: 4
      });
    });

    it('should return Sunday limit on Sunday', async () => {
      jest.setSystemTime(new Date('2026-07-05T12:00:00+09:00')); // Sunday 12 PM
      const limit = await background.getActiveLimit();
      expect(limit).toBe(7200);
    });

    it('should return Monday limit on Monday', async () => {
      jest.setSystemTime(new Date('2026-07-06T12:00:00+09:00')); // Monday 12 PM
      const limit = await background.getActiveLimit();
      expect(limit).toBe(3600);
    });

    it('should return Holiday limit on a public holiday', async () => {
      jest.setSystemTime(new Date('2026-01-01T12:00:00+09:00')); // New Year's Day (Jan 1)
      const limit = await background.getActiveLimit();
      expect(limit).toBe(9000);
    });

    it('should account for resetHour (return yesterday\'s limit before reset hour)', async () => {
      // 2026-07-06 03:00 AM (Monday morning before 4:00 AM reset)
      // Business day is Sunday, so it should return Sunday's limit (7200)
      jest.setSystemTime(new Date('2026-07-06T03:00:00+09:00'));
      const limit = await background.getActiveLimit();
      expect(limit).toBe(7200);
    });
  });
});
