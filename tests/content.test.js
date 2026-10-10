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
          get: jest.fn().mockResolvedValue({ isDebugEnabled: false })
        },
        onChanged: { addListener: jest.fn() }
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
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          contains: jest.fn(() => true),
          querySelector: jest.fn().mockReturnValue(null),
          querySelectorAll: jest.fn().mockReturnValue([]),
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
      contains: jest.fn(() => true),
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

    it('should keep blocking scroll, media, and navigation keys after countdown until overlay closes', () => {
      const overlay = document.createElement('div');
      overlay.id = 'yt-break-reminder-break-overlay';
      const btn = document.createElement('button');
      btn.id = 'ybr-resume-btn';
      btn.disabled = false;
      overlay.appendChild(btn);
      document.body.appendChild(overlay);

      const arrowDownEvent = {
        code: 'ArrowDown',
        key: 'ArrowDown',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBreakKeydown(arrowDownEvent);
      expect(arrowDownEvent.preventDefault).toHaveBeenCalled();
      expect(document.getElementById('yt-break-reminder-break-overlay')).not.toBeNull();

      const mediaEvent = {
        code: 'MediaPlayPause',
        key: 'MediaPlayPause',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };
      content.handleBreakKeydown(mediaEvent);
      expect(mediaEvent.preventDefault).toHaveBeenCalled();
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

  describe('pauseAllVideos() and resumeVideos() on multi-video pages', () => {
    it('should pause only playing videos and return them', () => {
      const video1 = { paused: true, pause: jest.fn(), play: jest.fn().mockResolvedValue(undefined) };
      const video2 = { paused: false, pause: jest.fn(), play: jest.fn().mockResolvedValue(undefined) };
      const video3 = { paused: false, pause: jest.fn(), play: jest.fn().mockResolvedValue(undefined) };

      global.document.querySelectorAll = jest.fn((sel) => {
        if (sel === 'video') return [video1, video2, video3];
        return [];
      });

      const pausedList = content.pauseAllVideos();
      expect(video1.pause).not.toHaveBeenCalled();
      expect(video2.pause).toHaveBeenCalled();
      expect(video3.pause).toHaveBeenCalled();
      expect(pausedList).toEqual([video2, video3]);
    });

    it('should resume only the videos that were actually playing and paused when break began', () => {
      const video1 = { paused: true, pause: jest.fn(), play: jest.fn().mockResolvedValue(undefined) };
      const video2 = { paused: false, pause: jest.fn(() => { video2.paused = true; }), play: jest.fn().mockResolvedValue(undefined) };

      global.document.querySelectorAll = jest.fn((sel) => {
        if (sel === 'video') return [video1, video2];
        return [];
      });

      // Break overlay triggered
      content.showBreakOverlay();

      expect(video1.pause).not.toHaveBeenCalled();
      expect(video2.pause).toHaveBeenCalled();

      // Resume from break
      content.resumeFromBreak();

      expect(video1.play).not.toHaveBeenCalled();
      expect(video2.play).toHaveBeenCalled();
    });

    it('should fallback to document querySelector for main video if paused videos were disconnected', () => {
      const disconnectedVideo = {
        paused: true,
        pause: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined)
      };

      global.document.querySelectorAll = jest.fn((sel) => {
        if (sel === 'video') return [disconnectedVideo];
        return [];
      });
      global.document.contains = jest.fn((el) => el !== disconnectedVideo);

      const fallbackMainVideo = {
        className: 'html5-main-video',
        paused: true,
        play: jest.fn().mockResolvedValue(undefined)
      };
      global.document.querySelector = jest.fn((sel) => {
        if (sel === 'video.html5-main-video') return fallbackMainVideo;
        return null;
      });

      disconnectedVideo.paused = false;
      content.showBreakOverlay();
      disconnectedVideo.paused = true;

      content.resumeFromBreak();

      expect(disconnectedVideo.play).not.toHaveBeenCalled();
      expect(fallbackMainVideo.play).toHaveBeenCalled();
    });

    it('should NOT resume playback when video was already paused before break on /watch page', () => {
      const pausedVideo = {
        className: 'html5-main-video',
        paused: true,
        pause: jest.fn(),
        play: jest.fn().mockResolvedValue(undefined)
      };

      global.document.querySelectorAll = jest.fn((sel) => {
        if (sel === 'video') return [pausedVideo];
        return [];
      });
      global.document.querySelector = jest.fn((sel) => {
        if (sel === 'video.html5-main-video') return pausedVideo;
        return null;
      });

      // Break triggered while video was paused on /watch
      content.showBreakOverlay();

      expect(pausedVideo.pause).not.toHaveBeenCalled();

      content.resumeFromBreak();

      expect(pausedVideo.play).not.toHaveBeenCalled();
    });

    it('should trigger play on video.html5-main-video if present and no tracked elements', () => {
      content.resumeVideos();
      expect(mockPlay).toHaveBeenCalled();
    });
  });

  describe('Extension Challenges & Block Overlay Tests', () => {
    it('handleBlockKeydown should allow input when target is INPUT element inside block overlay without stopping capture propagation', () => {
      const mockOverlay = document.createElement('div');
      mockOverlay.id = 'yt-break-reminder-block-overlay';
      const mockInput = document.createElement('input');
      mockOverlay.appendChild(mockInput);
      document.body.appendChild(mockOverlay);

      const mockEvent = {
        target: mockInput,
        code: 'KeyA',
        key: 'a',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBlockKeydown(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      mockOverlay.remove();
    });

    it('handleBlockKeydown should block keys when target is an INPUT element outside overlay (e.g. YouTube search bar)', () => {
      const mockOutsideInput = document.createElement('input');
      document.body.appendChild(mockOutsideInput);

      const mockEvent = {
        target: mockOutsideInput,
        code: 'KeyA',
        key: 'a',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBlockKeydown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      mockOutsideInput.remove();
    });

    it('handleBlockKeydown should block regular keys when not in an input field', () => {
      const mockEvent = {
        target: { tagName: 'DIV' },
        code: 'KeyA',
        key: 'a',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBlockKeydown(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });

    it('renderBlockDefaultUI should render start challenge button', () => {
      const card = {
        classList: { remove: jest.fn(), add: jest.fn() },
        innerHTML: '',
        querySelector: jest.fn(() => ({ addEventListener: jest.fn() }))
      };

      content.renderBlockDefaultUI(card);

      expect(card.innerHTML).toContain('ybr-start-challenge-btn');
      expect(card.innerHTML).toContain('延長チャレンジに挑戦する');
    });

    it('startRandomChallenge should render specified challenge', () => {
      const card = {
        classList: { add: jest.fn(), remove: jest.fn() },
        innerHTML: '',
        querySelector: jest.fn(() => ({ addEventListener: jest.fn(), focus: jest.fn() })),
        querySelectorAll: jest.fn(() => [])
      };

      content.startRandomChallenge(card, 'typing');
      expect(card.innerHTML).toContain('宣誓タイピング');

      content.startRandomChallenge(card, 'math');
      expect(card.innerHTML).toContain('脳トレ暗算');

      content.startRandomChallenge(card, 'touch');
      expect(card.innerHTML).toContain('数字タッチ');

      content.startRandomChallenge(card, 'stroop');
      expect(card.innerHTML).toContain('色あてテスト');

      content.startRandomChallenge(card, 'catch');
      expect(card.innerHTML).toContain('逃げるボタン捕獲');
    });

    it('handleChallengeClear should send EXTEND_TIME message', () => {
      const card = {
        innerHTML: ''
      };

      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({ success: true, todayExtendedSeconds: 1800, todayExtensionCount: 1 });
        }
      });

      content.handleChallengeClear(card);

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { type: 'EXTEND_TIME' },
        expect.any(Function)
      );
      expect(card.innerHTML).toContain('試練クリア！');
    });

    it('handleChallengeClear should not remove overlay or resume videos if EXTEND_TIME fails', () => {
      jest.useFakeTimers();
      const card = {
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue(null),
        classList: { remove: jest.fn() }
      };

      const mockVideo = { paused: true, play: jest.fn().mockResolvedValue() };
      document.querySelector = jest.fn().mockReturnValue(mockVideo);

      content.showBlockOverlay();
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();

      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({ success: false, reason: 'MAX_REACHED', message: '本日の延長上限に達しています。' });
        }
      });

      content.handleChallengeClear(card);

      expect(card.innerHTML).toContain('延長できませんでした');
      expect(card.innerHTML).toContain('本日の延長上限に達しています。');

      jest.advanceTimersByTime(2000);

      // オーバーレイが削除されず、動画も再生されていないことを検証
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();
      expect(mockVideo.play).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('handleChallengeClear should resume video only if it was playing before block overlay', () => {
      jest.useFakeTimers();
      const card = {
        innerHTML: '',
        classList: { remove: jest.fn() }
      };

      const mockPlayingVideo = {
        paused: false,
        pause: jest.fn(function() { this.paused = true; }),
        play: jest.fn().mockResolvedValue()
      };

      document.querySelectorAll = jest.fn().mockReturnValue([mockPlayingVideo]);
      document.body.appendChild = jest.fn();

      // ブロック表示（この時動画は再生中だった）
      content.showBlockOverlay();
      expect(mockPlayingVideo.pause).toHaveBeenCalled();

      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({ success: true, todayExtendedSeconds: 1800, todayExtensionCount: 1, extensionMinutes: 30 });
        }
      });

      content.handleChallengeClear(card);
      jest.advanceTimersByTime(1500);

      // 解除後に動画が再開されたことを確認
      expect(mockPlayingVideo.play).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('handleChallengeClear should not fallback-play another paused video if tracked video was disconnected', () => {
      jest.useFakeTimers();
      const card = {
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue(null),
        classList: { remove: jest.fn() }
      };

      const disconnectedVideo = {
        paused: false,
        pause: jest.fn(function() { this.paused = true; }),
        play: jest.fn().mockResolvedValue()
      };

      const otherPausedVideo = {
        paused: true,
        play: jest.fn().mockResolvedValue()
      };

      document.querySelectorAll = jest.fn().mockReturnValue([disconnectedVideo]);
      document.querySelector = jest.fn().mockReturnValue(otherPausedVideo);
      document.contains = jest.fn((el) => el !== disconnectedVideo);

      content.showBlockOverlay();
      expect(disconnectedVideo.pause).toHaveBeenCalled();

      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({ success: true, todayExtendedSeconds: 1800, todayExtensionCount: 1, extensionMinutes: 30 });
        }
      });

      content.handleChallengeClear(card);
      jest.advanceTimersByTime(1500);

      // 切断された動画も、無関係な別の停止中動画も再生されないこと
      expect(disconnectedVideo.play).not.toHaveBeenCalled();
      expect(otherPausedVideo.play).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('handleBlockKeydown should allow keys when target is inside block overlay', () => {
      const mockOverlay = document.createElement('div');
      mockOverlay.id = 'yt-break-reminder-block-overlay';
      const mockBtn = document.createElement('button');
      mockOverlay.appendChild(mockBtn);
      document.body.appendChild(mockOverlay);

      const mockEvent = {
        target: mockBtn,
        code: 'Enter',
        key: 'Enter',
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        stopImmediatePropagation: jest.fn()
      };

      content.handleBlockKeydown(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      mockOverlay.remove();
    });

    it('handleChallengeClear should keep block overlay and not resume video if still exceeded after extension', () => {
      jest.useFakeTimers();
      const card = {
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue(null),
        classList: { remove: jest.fn() }
      };

      const mockVideo = { paused: true, play: jest.fn().mockResolvedValue() };
      document.querySelector = jest.fn().mockReturnValue(mockVideo);

      content.showBlockOverlay();
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();

      // 制限5400秒(1.5h)に対して現在7200秒(2h)利用中、1800秒(30分)延長しても7200秒 >= 7200秒で上限到達のまま
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({
            success: true,
            todaySeconds: 7200,
            todayExtendedSeconds: 1800,
            todayExtensionCount: 1,
            extensionMinutes: 30,
            limitExceeded: true
          });
        }
      });

      content.handleChallengeClear(card);

      expect(card.innerHTML).toContain('本日の利用時間が新しい上限');
      jest.advanceTimersByTime(2000);

      // オーバーレイが維持され、動画も再生されていないことを検証
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();
      expect(mockVideo.play).not.toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('handleChallengeClear should re-check limit after 1.2s and keep block overlay if usage increased during delay', async () => {
      jest.useFakeTimers();
      let storageChangeHandler;
      global.chrome.storage.onChanged.addListener = jest.fn((cb) => {
        storageChangeHandler = cb;
      });

      jest.isolateModules(() => {
        content = require('../content');
      });

      // initを呼んでストレージ変更リスナーを登録
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'GET_STATUS' && cb) {
          cb({
            todaySeconds: 5000,
            limitSeconds: 5400,
            breakIntervalSeconds: 1800,
            todayExtendedSeconds: 0,
            todayExtensionCount: 0,
            maxExtensionsPerDay: 1,
            extensionMinutes: 30
          });
        }
      });
      document.visibilityState = 'visible';
      await content.init();

      const card = {
        innerHTML: '',
        querySelector: jest.fn().mockReturnValue(null),
        classList: { remove: jest.fn() }
      };

      const mockVideo = { paused: true, play: jest.fn().mockResolvedValue() };
      document.querySelector = jest.fn().mockReturnValue(mockVideo);

      content.showBlockOverlay();
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();

      // 延長成功時点では上限内（limit: 5400 + 1800 = 7200, todaySeconds: 7000）
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'EXTEND_TIME' && cb) {
          cb({
            success: true,
            todaySeconds: 7000,
            todayExtendedSeconds: 1800,
            todayExtensionCount: 1,
            extensionMinutes: 30,
            limitExceeded: false
          });
        }
      });

      content.handleChallengeClear(card);
      expect(card.innerHTML).toContain('延長されました');

      // 1.2秒待機中に別タブの利用時間増加で todaySeconds が 7300（> 7200）に更新されたとする
      if (storageChangeHandler) {
        storageChangeHandler({
          todaySeconds: { newValue: 7300, oldValue: 7000 }
        }, 'local');
      }

      // 1200ms タイマーを進める
      jest.advanceTimersByTime(1200);

      // 上限を超過したため、オーバーレイは解除されず制限画面が維持され、動画も再生されないこと
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();
      expect(mockVideo.play).not.toHaveBeenCalled();
      expect(card.innerHTML).toContain('超過しているため、引き続き制限中です');
      jest.useRealTimers();
    });

    it.each([
      [7300, true],
      [5400, false]
    ])('todayExtendedSeconds change while blocked re-checks with latest todaySeconds=%i (keep blocked: %s)', async (latestTodaySeconds, keepBlocked) => {
      let storageChangeHandler;
      global.chrome.storage.onChanged.addListener = jest.fn((cb) => {
        storageChangeHandler = cb;
      });

      jest.isolateModules(() => {
        content = require('../content');
      });

      const baseStatus = {
        todaySeconds: 5400,
        limitSeconds: 5400,
        breakIntervalSeconds: 1800,
        todayExtendedSeconds: 0,
        todayExtensionCount: 0,
        maxExtensionsPerDay: 1,
        extensionMinutes: 30
      };
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'GET_STATUS' && cb) cb(baseStatus);
      });
      document.visibilityState = 'visible';
      await content.init();
      expect(document.getElementById('yt-break-reminder-block-overlay')).not.toBeNull();

      // 別タブで延長された。手元の todaySeconds(5400) は古く、最新値は background だけが知っている
      chrome.runtime.sendMessage.mockImplementation((msg, cb) => {
        if (msg.type === 'GET_STATUS' && cb) {
          cb({ ...baseStatus, todaySeconds: latestTodaySeconds, todayExtendedSeconds: 1800, todayExtensionCount: 1 });
        }
      });
      storageChangeHandler({ todayExtendedSeconds: { newValue: 1800, oldValue: 0 } }, 'local');
      await Promise.resolve();
      await Promise.resolve();

      expect(document.getElementById('yt-break-reminder-block-overlay') !== null).toBe(keepBlocked);
    });

    it('does not let a wrong-answer redraw overwrite the block screen after giving up', () => {
      const els = {};
      const card = {
        innerHTML: '',
        classList: { add: jest.fn(), remove: jest.fn() },
        querySelectorAll: jest.fn(() => []),
        querySelector: jest.fn((sel) => {
          els[sel] = els[sel] || {
            value: '', textContent: '', className: '', style: {}, handlers: {},
            classList: { add: jest.fn(), remove: jest.fn() },
            addEventListener(type, fn) { this.handlers[type] = fn; },
            focus: jest.fn()
          };
          return els[sel];
        })
      };

      content.startRandomChallenge(card, 'math');
      els['#ybr-math-input'].value = '-1';
      els['#ybr-math-submit'].handlers.click();
      els['#ybr-challenge-cancel-btn'].handlers.click();
      expect(card.innerHTML).not.toContain('ybr-math-formula');

      jest.advanceTimersByTime(1000);

      expect(card.innerHTML).not.toContain('ybr-math-formula');
    });
  });
});
