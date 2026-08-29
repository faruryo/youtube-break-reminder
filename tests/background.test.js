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

global.document = {
  addEventListener: jest.fn(),
  querySelector: jest.fn().mockReturnValue({ r: { baseVal: { value: 50 } }, style: {} }),
  querySelectorAll: jest.fn().mockReturnValue([]),
  getElementById: jest.fn().mockReturnValue({ addEventListener: jest.fn(), classList: { add: jest.fn(), remove: jest.fn() }, style: {} })
};

const background = require('../background');
const popup = require('../popup');

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

    it('should return default weekday limit (1.5h) on a weekday if no setting is saved', async () => {
      chrome.storage.local.get.mockResolvedValue({
        resetHour: 4
      });
      jest.setSystemTime(new Date('2026-07-06T12:00:00+09:00')); // Monday
      const limit = await background.getActiveLimit();
      expect(limit).toBe(90 * 60); // 1.5h
    });

    it('should return default weekend limit (3h) on Saturday if no setting is saved', async () => {
      chrome.storage.local.get.mockResolvedValue({
        resetHour: 4
      });
      jest.setSystemTime(new Date('2026-07-11T12:00:00+09:00')); // Saturday
      const limit = await background.getActiveLimit();
      expect(limit).toBe(3 * 3600); // 3h
    });

    it('should return default weekend limit (3h) on Sunday if no setting is saved', async () => {
      chrome.storage.local.get.mockResolvedValue({
        resetHour: 4
      });
      jest.setSystemTime(new Date('2026-07-12T12:00:00+09:00')); // Sunday
      const limit = await background.getActiveLimit();
      expect(limit).toBe(3 * 3600); // 3h
    });

    it('should return default weekend limit (3h) on Holiday if no setting is saved', async () => {
      chrome.storage.local.get.mockResolvedValue({
        resetHour: 4
      });
      jest.setSystemTime(new Date('2026-01-01T12:00:00+09:00')); // New Year's Day
      const limit = await background.getActiveLimit();
      expect(limit).toBe(3 * 3600); // 3h
    });
  });

  describe('background.js - recordUsageHistory()', () => {
    it('should initialize usageHistory and record seconds for the current hour', async () => {
      chrome.storage.local.get.mockResolvedValue({}); // No existing data

      // 2026-08-25 14:30:00 JST (hour: 14)
      const mockTime = new Date('2026-08-25T14:30:00+09:00').getTime();
      await background.recordUsageHistory(10, mockTime);

      expect(chrome.storage.local.set).toHaveBeenCalled();
      const savedData = chrome.storage.local.set.mock.calls[0][0];
      
      expect(savedData.usageHistory).toBeDefined();
      expect(savedData.usageHistory['2026-08-25']).toBeDefined();
      expect(savedData.usageHistory['2026-08-25'].hourly[14]).toBe(10);
      expect(savedData.usageHistory['2026-08-25'].total).toBe(10);
      expect(savedData.usageHistory['2026-08-25'].hourly[0]).toBe(0);
    });

    it('should accumulate seconds in the same hour across multiple calls', async () => {
      const existingHistory = {
        '2026-08-25': {
          hourly: new Array(24).fill(0),
          total: 50
        }
      };
      existingHistory['2026-08-25'].hourly[14] = 50;

      chrome.storage.local.get.mockResolvedValue({ usageHistory: existingHistory });

      const mockTime = new Date('2026-08-25T14:35:00+09:00').getTime();
      await background.recordUsageHistory(30, mockTime);

      const savedData = chrome.storage.local.set.mock.calls[0][0];
      expect(savedData.usageHistory['2026-08-25'].hourly[14]).toBe(80);
      expect(savedData.usageHistory['2026-08-25'].total).toBe(80);
    });

    it('should record into different hours correctly', async () => {
      const existingHistory = {
        '2026-08-25': {
          hourly: new Array(24).fill(0),
          total: 60
        }
      };
      existingHistory['2026-08-25'].hourly[10] = 60;

      chrome.storage.local.get.mockResolvedValue({ usageHistory: existingHistory });

      const mockTime = new Date('2026-08-25T21:15:00+09:00').getTime();
      await background.recordUsageHistory(120, mockTime);

      const savedData = chrome.storage.local.set.mock.calls[0][0];
      expect(savedData.usageHistory['2026-08-25'].hourly[10]).toBe(60);
      expect(savedData.usageHistory['2026-08-25'].hourly[21]).toBe(120);
      expect(savedData.usageHistory['2026-08-25'].total).toBe(180);
    });

    it('should purge entries older than 365 days', async () => {
      const largeHistory = {};
      for (let i = 1; i <= 370; i++) {
        const dateKey = `2025-01-${String(i).padStart(3, '0')}`;
        largeHistory[dateKey] = { hourly: new Array(24).fill(0), total: 100 };
      }

      chrome.storage.local.get.mockResolvedValue({ usageHistory: largeHistory });

      const mockTime = new Date('2026-08-25T14:00:00+09:00').getTime();
      await background.recordUsageHistory(10, mockTime);

      const savedData = chrome.storage.local.set.mock.calls[0][0];
      const remainingKeys = Object.keys(savedData.usageHistory);
      expect(remainingKeys.length).toBeLessThanOrEqual(365);
    });
  });

  describe('popup.js - Formatting & Aggregation Helpers', () => {
    it('formatDateKey() should return YYYY-MM-DD format', () => {
      const d = new Date('2026-08-05T10:00:00+09:00');
      expect(popup.formatDateKey(d)).toBe('2026-08-05');
    });

    it('formatTimeJapanese() should format seconds into Japanese representation', () => {
      expect(popup.formatTimeJapanese(0)).toBe('0分');
      expect(popup.formatTimeJapanese(45)).toBe('45秒');
      expect(popup.formatTimeJapanese(120)).toBe('2分');
      expect(popup.formatTimeJapanese(3600)).toBe('1時間');
      expect(popup.formatTimeJapanese(5400)).toBe('1時間30分');
    });

    it('findPeakHour() should find the hour with highest viewing seconds', () => {
      const hourly = new Array(24).fill(0);
      hourly[9] = 600;  // 9:00 -> 10m
      hourly[21] = 3600; // 21:00 -> 60m
      hourly[22] = 1800; // 22:00 -> 30m

      const peak = popup.findPeakHour(hourly);
      expect(peak.hour).toBe(21);
      expect(peak.maxSeconds).toBe(3600);
    });

    it('findPeakHour() should return hour: -1 when all slots are 0', () => {
      const hourly = new Array(24).fill(0);
      const peak = popup.findPeakHour(hourly);
      expect(peak.hour).toBe(-1);
      expect(peak.maxSeconds).toBe(0);
    });

    it('aggregateDailyHistory() should return day stats correctly', () => {
      const mockHistory = {
        '2026-08-25': {
          hourly: new Array(24).fill(0),
          total: 1200
        }
      };
      mockHistory['2026-08-25'].hourly[15] = 1200;

      const daily = popup.aggregateDailyHistory('2026-08-25', mockHistory);
      expect(daily.total).toBe(1200);
      expect(daily.hourly[15]).toBe(1200);
      expect(daily.hourly[0]).toBe(0);
    });

    it('aggregateWeeklyHistory() should group 7 days starting from Monday', () => {
      const mockHistory = {
        '2026-08-24': { hourly: new Array(24).fill(0), total: 3600 }, // Mon
        '2026-08-25': { hourly: new Array(24).fill(0), total: 7200 }, // Tue
        '2026-08-26': { hourly: new Array(24).fill(0), total: 1800 }, // Wed
      };
      mockHistory['2026-08-24'].hourly[20] = 3600;
      mockHistory['2026-08-25'].hourly[20] = 3600;
      mockHistory['2026-08-25'].hourly[21] = 3600;
      mockHistory['2026-08-26'].hourly[20] = 1800;

      const targetDate = new Date('2026-08-26T12:00:00+09:00');
      const weekly = popup.aggregateWeeklyHistory(targetDate, mockHistory);

      expect(weekly.mondayDateStr).toBe('2026-08-24');
      expect(weekly.sundayDateStr).toBe('2026-08-30');
      expect(weekly.days.length).toBe(7);
      expect(weekly.total).toBe(12600);
      expect(weekly.average).toBe(Math.round(12600 / 7));
      expect(weekly.hourly[20]).toBe(9000);
      expect(weekly.hourly[21]).toBe(3600);
    });

    it('aggregateMonthlyHistory() should group all days in the given month', () => {
      const mockHistory = {
        '2026-08-01': { hourly: new Array(24).fill(0), total: 1000 },
        '2026-08-15': { hourly: new Array(24).fill(0), total: 2000 },
        '2026-08-31': { hourly: new Array(24).fill(0), total: 3000 },
        '2026-09-01': { hourly: new Array(24).fill(0), total: 5000 },
      };
      mockHistory['2026-08-01'].hourly[8] = 1000;
      mockHistory['2026-08-15'].hourly[8] = 2000;
      mockHistory['2026-08-31'].hourly[8] = 3000;

      const targetDate = new Date('2026-08-10T12:00:00+09:00');
      const monthly = popup.aggregateMonthlyHistory(targetDate, mockHistory);

      expect(monthly.year).toBe(2026);
      expect(monthly.month).toBe(8);
      expect(monthly.daysInMonth).toBe(31);
      expect(monthly.days.length).toBe(31);
      expect(monthly.total).toBe(6000);
      expect(monthly.average).toBe(Math.round(6000 / 31));
      expect(monthly.hourly[8]).toBe(6000);
    });
  });
});
