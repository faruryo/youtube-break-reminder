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
    it('should NOT reset continuous seconds if last heartbeat was within 60 seconds', async () => {
      const now = Date.now();
      const lastHeartbeatTime = now - 30 * 1000; // 30秒前

      chrome.storage.local.get.mockResolvedValue({
        continuousSeconds: 600, // 10分
        lastHeartbeatTime: lastHeartbeatTime
      });

      jest.setSystemTime(now);

      const result = await background.checkAndResetContinuous();
      
      expect(result).toBe(600);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should reset continuous seconds to 0 if last heartbeat was more than 60 seconds ago', async () => {
      const now = Date.now();
      const lastHeartbeatTime = now - 70 * 1000; // 70秒前 (60秒超)

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
});
