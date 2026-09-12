let todaySeconds = 0;
let limitSeconds = 90 * 60; // 1.5時間
let breakIntervalSeconds = 30 * 60; // 30分

let continuousSeconds = 0;
let heartbeatIntervalId = null;
let isBlocked = false;
let isBreakShowing = false;
let isDebugEnabled = false;

let shouldResumeVideo = false;
let breakCountdownInterval = null;
let breakKeydownListener = null;
let breakClickListener = null;
let blockKeydownListener = null;

// ユーザーのアクティビティを監視するための変数
let lastInteractionTime = Date.now();

// 起動時の初期化
async function init() {
  // ユーザーのインタラクション（スクロールなど）の監視を開始
  registerInteractionListeners();

  // バックグラウンドから現在のステータスと設定を取得
  const status = await getStatusFromBackground();
  if (status) {
    todaySeconds = status.todaySeconds;
    limitSeconds = status.limitSeconds;
    breakIntervalSeconds = status.breakIntervalSeconds;
  }
  
  // ストレージからデバッグモード設定を取得
  const data = await chrome.storage.local.get(['isDebugEnabled']);
  isDebugEnabled = !!data.isDebugEnabled;

  // 初期状態で既に制限時間を超えているか確認
  if (todaySeconds >= limitSeconds) {
    showBlockOverlay();
    return;
  }
  
  // ハートビート計測を開始
  startHeartbeat();
  
  // ストレージの変更を監視して、設定が変更されたらリアルタイムに反映
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.limitSeconds) {
        limitSeconds = changes.limitSeconds.newValue;
        checkDailyLimit();
      }
      if (changes.breakIntervalSeconds) {
        breakIntervalSeconds = changes.breakIntervalSeconds.newValue;
      }
      if (changes.todaySeconds) {
        todaySeconds = changes.todaySeconds.newValue;
        checkDailyLimit();
      }
      if (changes.isDebugEnabled) {
        isDebugEnabled = !!changes.isDebugEnabled.newValue;
        // 即座にデバッグ表示を切り替える
        const isVisible = document.visibilityState === 'visible';
        const playing = isVideoPlaying();
        const recentInteraction = (Date.now() - lastInteractionTime) < 60000;
        const isActive = isVisible && (playing || recentInteraction);
        updateDebugPanel(isVisible, playing, recentInteraction, isActive);
      }
    }
  });
}

// ユーザーの操作（スクロール、マウス、キー入力など）を監視
function registerInteractionListeners() {
  const updateInteraction = () => {
    lastInteractionTime = Date.now();
  };
  
  const events = ['scroll', 'mousemove', 'keydown', 'click', 'wheel', 'touchstart'];
  events.forEach(event => {
    document.addEventListener(event, updateInteraction, { passive: true });
  });
}

// デバッグパネルの作成とリアルタイム更新
function updateDebugPanel(isVisible, playing, recentInteraction, isActive) {
  if (!isDebugEnabled) {
    const existingPanel = document.getElementById('ybr-debug-panel');
    if (existingPanel) {
      existingPanel.remove();
    }
    return;
  }
  
  let panel = document.getElementById('ybr-debug-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ybr-debug-panel';
    // 画面左下に半透明のコンパクトなデバッグ情報を表示
    panel.style.cssText = 'position: fixed; bottom: 10px; left: 10px; background: rgba(15, 15, 15, 0.85); color: #00ff00; padding: 10px 14px; font-family: monospace; font-size: 11px; z-index: 2147483646; border-radius: 8px; pointer-events: none; line-height: 1.5; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.5);';
    document.body.appendChild(panel);
  }
  
  const idleDiff = Date.now() - lastInteractionTime;
  const idleText = lastInteractionTime === 0 ? 'Timeout' : `${Math.round(idleDiff / 1000)}s / 60s`;
  
  panel.innerHTML = `
    <div style="font-weight:bold;margin-bottom:4px;color:#ff0000;font-family:sans-serif;">☕ YBR DEBUG</div>
    Active: <span style="color:${isActive ? '#00ff00' : '#ff4e50'}">${isActive ? 'TRUE' : 'FALSE'}</span><br>
    Visible: ${isVisible}<br>
    Playing: ${playing}<br>
    RecentInteract: ${recentInteraction}<br>
    Idle Time: ${idleText}
  `;
}

// YouTubeで動画が再生中であるか確認
function isVideoPlaying() {
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    // 一時停止されておらず、終了していないビデオがあれば再生中とみなす
    if (!video.paused && !video.ended) {
      return true;
    }
  }
  return false;
}

// バックグラウンドからステータスを取得
function getStatusFromBackground() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Failed to contact background:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// ハートビート処理の開始
function startHeartbeat() {
  if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
  
  heartbeatIntervalId = setInterval(async () => {
    // アクティブ判定の拡張:
    // 1. タブが表示されている (visibilityState === 'visible')
    // 2. かつ、以下のいずれかを満たしている：
    //    - 動画が実際に再生中である（じっと見ている時間）
    //    - 直近1分（60秒）以内に何かしらの操作（スクロールやクリックなど）があった（探索している時間）
    const isVisible = document.visibilityState === 'visible';
    const playing = isVideoPlaying();
    const recentInteraction = (Date.now() - lastInteractionTime) < 60000; // 60秒の操作バッファ
    
    const isActive = isVisible && (playing || recentInteraction);
    
    // デバッグ表示の更新
    updateDebugPanel(isVisible, playing, recentInteraction, isActive);
    
    if (isActive && !isBlocked && !isBreakShowing) {
      continuousSeconds++;
      
      // バックグラウンドに時間計測を通知
      chrome.runtime.sendMessage({ type: 'HEARTBEAT' }, (response) => {
        if (chrome.runtime.lastError) return;
        
        if (response && response.success) {
          todaySeconds = response.todaySeconds;
          continuousSeconds = response.continuousSeconds || 0;
          
          if (response.limitExceeded) {
            showBlockOverlay();
          } else {
            checkIntervalBreak();
          }
        }
      });
    } else {
      // 非アクティブかつ動画再生中の場合は、別タブに回ったとみなして一時停止させる
      if (!isActive || !isVisible) {
        pauseAllVideos();
      }
    }
  }, 1000);
}

// 動画の一時停止
function pauseAllVideos() {
  const videos = document.querySelectorAll('video');
  videos.forEach(video => {
    if (!video.paused) {
      video.pause();
    }
  });
}

// 動画の自動再生
function resumeVideos() {
  const mainVideo = document.querySelector('video.html5-main-video') || document.querySelector('video');
  if (mainVideo) {
    mainVideo.play().catch(err => {
      console.warn('Failed to auto-play video:', err);
    });
  }
}

// デイリー制限のチェック
function checkDailyLimit() {
  if (todaySeconds >= limitSeconds) {
    showBlockOverlay();
  } else if (isBlocked && todaySeconds < limitSeconds) {
    // 制限時間が引き上げられたりリセットされた場合は解除
    removeBlockOverlay();
  }
}

// 連続視聴制限（休憩）のチェック
function checkIntervalBreak() {
  if (continuousSeconds >= breakIntervalSeconds) {
    showBreakOverlay();
  }
}

// キーの長押し（repeat）が解除後に漏れてスクロールや意図しない再生を起こさないよう、keyupまで一時遮断
function blockKeyUntilRelease(releasedKeyCode) {
  let fallbackTimeout = null;
  const handleReleasingKey = (e) => {
    if (e.code === releasedKeyCode || e.key === releasedKeyCode) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type === 'keyup') {
        if (fallbackTimeout) clearTimeout(fallbackTimeout);
        document.removeEventListener('keydown', handleReleasingKey, true);
        document.removeEventListener('keyup', handleReleasingKey, true);
      }
    }
  };
  document.addEventListener('keydown', handleReleasingKey, true);
  document.addEventListener('keyup', handleReleasingKey, true);

  // ウィンドウのフォーカス外れ等でkeyupを取りこぼした場合のフォールバック解除
  fallbackTimeout = setTimeout(() => {
    document.removeEventListener('keydown', handleReleasingKey, true);
    document.removeEventListener('keyup', handleReleasingKey, true);
  }, 2000);
}

// デイリー制限オーバーレイ表示中のキー入力ハンドラ
function handleBlockKeydown(e) {
  // ブラウザのショートカット（Cmd+..., Ctrl+..., Alt+...）は除外
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }
  // 背後動画の再生やスクロールキー（Space, 矢印キー, PageUp/Downなど）を完全に遮断
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// デイリー制限オーバーレイの表示
function showBlockOverlay() {
  if (isBlocked) return;
  isBlocked = true;
  pauseAllVideos();
  
  // 既存のオーバーレイを削除
  removeBreakOverlay();
  
  const overlay = document.createElement('div');
  overlay.id = 'yt-break-reminder-block-overlay';
  overlay.innerHTML = `
    <div class="ybr-card">
      <div class="ybr-icon">⏳</div>
      <h1>本日のYouTubeは終了です</h1>
      <p>今日の視聴・ブラウジング時間が制限時間（${formatTime(limitSeconds)}）に達しました。</p>
      <p class="ybr-subtext">明日のリセットをお楽しみに。今日やりたかった他のことに時間を使いましょう！</p>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // ユーザーがHTML要素を消せないように、要素の削除を防止（簡易的なMutationObserver）
  observeOverlayRemoval(overlay.id);
  
  // 動画が裏で再生されるのを防止し続ける
  preventVideoPlayback();

  // キーボードイベントの登録（Spaceキー等による裏動画再生・スクロール抑止）
  if (blockKeydownListener) {
    document.removeEventListener('keydown', blockKeydownListener, true);
  }
  blockKeydownListener = handleBlockKeydown;
  document.addEventListener('keydown', blockKeydownListener, true);
}

// デイリー制限オーバーレイの削除
function removeBlockOverlay() {
  if (blockKeydownListener) {
    document.removeEventListener('keydown', blockKeydownListener, true);
    blockKeydownListener = null;
  }
  const overlay = document.getElementById('yt-break-reminder-block-overlay');
  if (overlay) overlay.remove();
  isBlocked = false;
}

// 休憩オーバーレイ表示中のキー入力ハンドラ
function handleBreakKeydown(e) {
  // ブラウザのショートカット（Cmd+..., Ctrl+..., Alt+...）は除外
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }

  const btn = document.getElementById('ybr-resume-btn');
  const isCountingDown = btn && btn.disabled;

  const isSpace = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;
  const isEnter = e.code === 'Enter' || e.key === 'Enter' || e.keyCode === 13;

  if (isCountingDown) {
    // カウントダウン中は動画操作やスクロールを防ぐためキー入力を遮断
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  if (isSpace || isEnter) {
    // YouTubeのデフォルトショートカットやスクロール、二重発火を防止
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    // カウントダウンが終了し、ボタンが活性化している場合のみ再開
    if (btn && !btn.disabled) {
      // SpaceまたはEnterの長押し（repeat）が解除後に漏れないよう、keyupまでガード
      blockKeyUntilRelease(e.code || e.key);
      resumeFromBreak();
    }
  }
}

// 休憩オーバーレイを解除し、動画再生を再開
function resumeFromBreak() {
  removeBreakOverlay();
  if (shouldResumeVideo) {
    resumeVideos();
  }
}

// 休憩促進オーバーレイの表示
function showBreakOverlay() {
  if (isBreakShowing) return;
  isBreakShowing = true;

  // 休憩に入る直前に動画が再生中だったか、または視聴ページにいるかを記録
  shouldResumeVideo = isVideoPlaying() || window.location.pathname === '/watch';

  pauseAllVideos();

  // 入力欄等にフォーカスが残っていれば外す
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }

  const overlay = document.createElement('div');
  overlay.id = 'yt-break-reminder-break-overlay';

  const cooldownPeriod = 20; // 20秒の強制休憩時間
  let remainingSeconds = cooldownPeriod;

  overlay.innerHTML = `
    <div class="ybr-card">
      <div class="ybr-icon">☕</div>
      <h1>少し休憩しましょう！</h1>
      <p>連続で ${formatTime(breakIntervalSeconds)} 以上、YouTubeを利用しています。</p>
      <p class="ybr-subtext">画面から目を離し、立ち上がってストレッチをしたり、水分を取ることをおすすめします。</p>
      <button id="ybr-resume-btn" disabled>休憩中... (${remainingSeconds}秒)</button>
    </div>
  `;
  document.body.appendChild(overlay);

  preventVideoPlayback();

  // カウントダウン処理
  if (breakCountdownInterval) clearInterval(breakCountdownInterval);
  breakCountdownInterval = setInterval(() => {
    remainingSeconds--;
    const btn = document.getElementById('ybr-resume-btn');
    if (btn) {
      if (remainingSeconds <= 0) {
        clearInterval(breakCountdownInterval);
        breakCountdownInterval = null;
        btn.textContent = '視聴を再開する (Space / Enter)';
        btn.disabled = false;
        btn.classList.add('active');
        btn.focus();
      } else {
        btn.textContent = `休憩中... (${remainingSeconds}秒)`;
      }
    } else {
      clearInterval(breakCountdownInterval);
      breakCountdownInterval = null;
    }
  }, 1000);

  // キーボードイベントの登録（キャプチャフェーズ）
  if (breakKeydownListener) {
    document.removeEventListener('keydown', breakKeydownListener, true);
  }
  breakKeydownListener = handleBreakKeydown;
  document.addEventListener('keydown', breakKeydownListener, true);

  // 再開ボタンのクリックイベント
  if (breakClickListener) {
    document.removeEventListener('click', breakClickListener);
  }
  breakClickListener = (e) => {
    if (e.target && e.target.id === 'ybr-resume-btn' && !e.target.disabled) {
      resumeFromBreak();
    }
  };
  document.addEventListener('click', breakClickListener);
}

// 休憩促進オーバーレイの削除
function removeBreakOverlay() {
  if (breakCountdownInterval) {
    clearInterval(breakCountdownInterval);
    breakCountdownInterval = null;
  }
  if (breakKeydownListener) {
    document.removeEventListener('keydown', breakKeydownListener, true);
    breakKeydownListener = null;
  }
  if (breakClickListener) {
    document.removeEventListener('click', breakClickListener);
    breakClickListener = null;
  }

  const overlay = document.getElementById('yt-break-reminder-break-overlay');
  if (overlay) overlay.remove();
  continuousSeconds = 0;
  isBreakShowing = false;

  // バックグラウンド側の連続視聴時間もリセット
  chrome.runtime.sendMessage({ type: 'RESET_CONTINUOUS' });
}

// 秒数から人間が見やすい時間表現に変換 (例: 1時間30分)
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}時間${mins > 0 ? mins + '分' : ''}`;
  }
  return `${mins}分`;
}

// 動画の再生を防止する仕組み
let preventPlayListener = null;
function preventVideoPlayback() {
  if (preventPlayListener) return;
  
  preventPlayListener = (e) => {
    if (isBlocked || isBreakShowing) {
      const video = e.target;
      video.pause();
    }
  };
  
  document.addEventListener('play', preventPlayListener, true);
}

// 要素の削除を監視して復活させる
function observeOverlayRemoval(elementId) {
  const targetNode = document.body;
  const config = { childList: true };
  
  const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const removed = Array.from(mutation.removedNodes).some(node => node.id === elementId);
        if (removed && (isBlocked || (elementId === 'yt-break-reminder-break-overlay' && isBreakShowing))) {
          // 要素が消されたら再作成
          if (elementId === 'yt-break-reminder-block-overlay') {
            isBlocked = false;
            showBlockOverlay();
          } else if (elementId === 'yt-break-reminder-break-overlay') {
            isBreakShowing = false;
            showBreakOverlay();
          }
        }
      }
    }
  });
  
  observer.observe(targetNode, config);
}

// 実行開始
if (typeof process === 'undefined' || !process.env.JEST_WORKER_ID) {
  if (typeof window !== 'undefined' && window.location && window.location.hostname === 'music.youtube.com') {
    // YouTube Musicは測定対象外にするため、初期化処理を行わない
  } else if (typeof window !== 'undefined') {
    init();
  }
}

if (typeof module !== 'undefined') {
  module.exports = {
    handleBreakKeydown,
    handleBlockKeydown,
    resumeFromBreak,
    resumeVideos,
    pauseAllVideos,
    showBreakOverlay,
    removeBreakOverlay,
    showBlockOverlay,
    removeBlockOverlay,
    blockKeyUntilRelease,
    formatTime
  };
}
