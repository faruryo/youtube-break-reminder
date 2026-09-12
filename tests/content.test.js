// tests/content.test.js

describe('YouTube Break Reminder - content.js Space / Enter Key & Auto-Resume Tests', () => {
  let content;
  let mockPlay;
  let elementsMap;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    elementsMap = new Map();

    mockPlay = jest.fn().mockResolvedValue(undefined);

    global.chrome = {
      runtime: {
        sendMessage: jest.fn(),
        lastError: null
      },
      storage: {
        local: {
          get: jest.fn().mockResolvedValue({ isDebugEnabled: false }),
          onChanged: { addListener: jest.fn() }
        }
      }
    };

    global.window = {
      location: {
        hostname: 'www.youtube.com',
        pathname: '/watch'
      },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };

    global.document = {
      activeElement: { blur: jest.fn() },
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      createElement: jest.fn((tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          id: '',
          className: '',
          disabled: false,
          textContent: '',
          innerHTML: '',
          classList: {
            add: jest.fn(),
            remove: jest.fn()
          },
          focus: jest.fn(),
          blur: jest.fn(),
          remove: jest.fn(() => {
            if (el.id) elementsMap.delete(el.id);
          }),
          appendChild: jest.fn((child) => {
            if (child.id) elementsMap.set(child.id, child);
          })
        };
        if (tag === 'video') {
          el.play = mockPlay;
          el.pause = jest.fn();
          el.paused = true;
          el.ended = false;
        }
        return el;
      }),
      getElementById: jest.fn((id) => elementsMap.get(id) || null),
      querySelector: jest.fn((selector) => {
        if (selector === 'video.html5-main-video' || selector === 'video') {
          const video = document.createElement('video');
          video.className = 'html5-main-video';
          return video;
        }
        return null;
      }),
      querySelectorAll: jest.fn((selector) => {
        if (selector === 'video') {
          return [];
        }
        return [];
      }),
      body: {
        appendChild: jest.fn((el) => {
          if (el.id) elementsMap.set(el.id, el);
        })
      }
    };

    // Re-require content.js for a clean environment
    jest.isolateModules(() => {
      content = require('../content');
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('handleBreakKeydown()', () => {
    it('should consume event and resume when Space is pressed and button is enabled', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = false;
      btn.textContent = '視聴を再開する (Space / Enter)';
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'Space',
        key: ' ',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.stopImmediatePropagation).toHaveBeenCalled();
      expect(document.getElementById('yt-break-reminder-break-overlay')).toBeNull();
      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'RESET_CONTINUOUS' });
    });

    it('should consume event and resume when Enter is pressed and button is enabled', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = false;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'Enter',
        key: 'Enter',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.stopImmediatePropagation).toHaveBeenCalled();
      expect(document.getElementById('yt-break-reminder-break-overlay')).toBeNull();
    });

    it('should block Space/Enter during countdown when button is disabled', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = true;
      btn.textContent = '休憩中... (15秒)';
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'Space',
        key: ' ',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);

      // Event is suppressed to avoid background playback or scrolling
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.stopImmediatePropagation).toHaveBeenCalled();
      // But overlay is NOT removed
      expect(document.getElementById('yt-break-reminder-break-overlay')).not.toBeNull();
      expect(global.chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should block scroll keys like ArrowDown during countdown', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = true;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'ArrowDown',
        key: 'ArrowDown',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.stopImmediatePropagation).toHaveBeenCalled();
    });

    it('should ignore other keys (e.g. KeyA) after countdown', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = false;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'KeyA',
        key: 'a',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(document.getElementById('yt-break-reminder-break-overlay')).not.toBeNull();
    });

    it('should block modified scroll keys like Ctrl+Home or Shift+Space during countdown', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = true;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const ctrlHomeEvent = {
        code: 'Home',
        key: 'Home',
        ctrlKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBreakKeydown(ctrlHomeEvent);
      expect(ctrlHomeEvent.preventDefault).toHaveBeenCalled();

      const shiftSpaceEvent = {
        code: 'Space',
        key: ' ',
        shiftKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBreakKeydown(shiftSpaceEvent);
      expect(shiftSpaceEvent.preventDefault).toHaveBeenCalled();
    });

    it('should not resume with modified keys like Cmd+Space or Ctrl+Enter after countdown', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = false;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const event = {
        code: 'Space',
        key: ' ',
        metaKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(document.getElementById('yt-break-reminder-break-overlay')).not.toBeNull();
    });

    it('should allow browser shortcuts with meta/ctrl/alt key', () => {
      const event = {
        code: 'KeyR',
        key: 'r',
        metaKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBreakKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleBlockKeydown()', () => {
    it('should block Space and scroll keys (ArrowDown, PageDown, Ctrl+Home) during daily limit block overlay', () => {
      const spaceEvent = {
        code: 'Space',
        key: ' ',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBlockKeydown(spaceEvent);
      expect(spaceEvent.preventDefault).toHaveBeenCalled();

      const ctrlHomeEvent = {
        code: 'Home',
        key: 'Home',
        ctrlKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBlockKeydown(ctrlHomeEvent);
      expect(ctrlHomeEvent.preventDefault).toHaveBeenCalled();

      const ctrlMediaEvent = {
        code: 'MediaPlayPause',
        key: 'MediaPlayPause',
        ctrlKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBlockKeydown(ctrlMediaEvent);
      expect(ctrlMediaEvent.preventDefault).toHaveBeenCalled();

      const ctrlMediaPlayEvent = {
        code: 'MediaPlay',
        key: 'MediaPlay',
        ctrlKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBlockKeydown(ctrlMediaPlayEvent);
      expect(ctrlMediaPlayEvent.preventDefault).toHaveBeenCalled();

      const ctrlFastForwardEvent = {
        code: 'MediaFastForward',
        key: 'MediaFastForward',
        ctrlKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBlockKeydown(ctrlFastForwardEvent);
      expect(ctrlFastForwardEvent.preventDefault).toHaveBeenCalled();
    });

    it('should allow browser shortcuts (Cmd/Ctrl) for non-scroll keys during daily limit overlay', () => {
      const event = {
        code: 'KeyW',
        key: 'w',
        metaKey: true,
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBlockKeydown(event);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('isScrollOrMediaKey()', () => {
    it('should return true for predefined scroll and media keys', () => {
      expect(content.isScrollOrMediaKey({ code: 'Space' })).toBe(true);
      expect(content.isScrollOrMediaKey({ key: ' ' })).toBe(true);
      expect(content.isScrollOrMediaKey({ code: 'ArrowDown' })).toBe(true);
      expect(content.isScrollOrMediaKey({ key: 'PageUp' })).toBe(true);
      expect(content.isScrollOrMediaKey({ code: 'MediaPlayPause' })).toBe(true);
    });

    it('should return true for any key or code prefixed with Media or Audio', () => {
      expect(content.isScrollOrMediaKey({ code: 'MediaPlay' })).toBe(true);
      expect(content.isScrollOrMediaKey({ key: 'MediaPause' })).toBe(true);
      expect(content.isScrollOrMediaKey({ code: 'MediaFastForward' })).toBe(true);
      expect(content.isScrollOrMediaKey({ code: 'MediaRewind' })).toBe(true);
      expect(content.isScrollOrMediaKey({ code: 'AudioVolumeUp' })).toBe(true);
      expect(content.isScrollOrMediaKey({ key: 'AudioVolumeMute' })).toBe(true);
    });

    it('should return false for regular alphanumeric and navigation keys', () => {
      expect(content.isScrollOrMediaKey({ code: 'KeyA', key: 'a' })).toBe(false);
      expect(content.isScrollOrMediaKey({ code: 'Enter', key: 'Enter' })).toBe(false);
      expect(content.isScrollOrMediaKey({ code: 'Tab', key: 'Tab' })).toBe(false);
      expect(content.isScrollOrMediaKey(null)).toBe(false);
    });
  });

  describe('blockKeyUntilRelease()', () => {
    it('should block repeat keydown indefinitely until keyup occurs (even past 2s)', () => {
      let keydownListener;
      let keyupListener;
      document.addEventListener.mockImplementation((type, fn) => {
        if (type === 'keydown') keydownListener = fn;
        if (type === 'keyup') keyupListener = fn;
      });

      content.blockKeyUntilRelease('Space', ' ');

      expect(keydownListener).toBeDefined();
      expect(keyupListener).toBeDefined();

      // Fast-forward 5 seconds while holding key
      jest.advanceTimersByTime(5000);

      // Test repeat keydown after 5 seconds
      const repeatEvent = {
        code: 'Space',
        type: 'keydown',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      keydownListener(repeatEvent);
      expect(repeatEvent.preventDefault).toHaveBeenCalled();
      expect(repeatEvent.stopPropagation).toHaveBeenCalled();

      // Test keyup release
      const releaseEvent = {
        code: 'Space',
        type: 'keyup',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      keyupListener(releaseEvent);
      expect(releaseEvent.preventDefault).toHaveBeenCalled();
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', keydownListener, true);
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', keyupListener, true);
    });

    it('should NOT release Enter guard when NumpadEnter keyup occurs', () => {
      let keydownListener;
      let keyupListener;
      document.addEventListener.mockImplementation((type, fn) => {
        if (type === 'keydown') keydownListener = fn;
        if (type === 'keyup') keyupListener = fn;
      });

      // Guard initiated by standard Enter (code: Enter, key: Enter)
      content.blockKeyUntilRelease('Enter', 'Enter');

      // NumpadEnter keyup (code: NumpadEnter, key: Enter) occurs
      const numpadReleaseEvent = {
        code: 'NumpadEnter',
        key: 'Enter',
        type: 'keyup',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      keyupListener(numpadReleaseEvent);

      // Should NOT have removed listeners
      expect(document.removeEventListener).not.toHaveBeenCalled();

      // Standard Enter keydown repeat should still be blocked
      const enterRepeatEvent = {
        code: 'Enter',
        key: 'Enter',
        type: 'keydown',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      keydownListener(enterRepeatEvent);
      expect(enterRepeatEvent.preventDefault).toHaveBeenCalled();

      // Finally, standard Enter keyup releases the guard
      const enterReleaseEvent = {
        code: 'Enter',
        key: 'Enter',
        type: 'keyup',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      keyupListener(enterReleaseEvent);
      expect(enterReleaseEvent.preventDefault).toHaveBeenCalled();
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', keydownListener, true);
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', keyupListener, true);
    });

    it('should release listeners when window blur occurs', () => {
      let blurListener;
      let keydownListener;
      let keyupListener;
      document.addEventListener.mockImplementation((type, fn) => {
        if (type === 'keydown') keydownListener = fn;
        if (type === 'keyup') keyupListener = fn;
      });
      global.window.addEventListener.mockImplementation((type, fn) => {
        if (type === 'blur') blurListener = fn;
      });

      content.blockKeyUntilRelease('Space', ' ');

      expect(blurListener).toBeDefined();
      blurListener();

      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', keydownListener, true);
      expect(document.removeEventListener).toHaveBeenCalledWith('keyup', keyupListener, true);
    });
  });

  describe('resumeVideos()', () => {
    it('should trigger play on video.html5-main-video if present', () => {
      content.resumeVideos();
      expect(mockPlay).toHaveBeenCalled();
    });
  });
});
