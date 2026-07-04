let todaySeconds = 0;
let limitSeconds = 90 * 60; // 1.5時間
let breakIntervalSeconds = 30 * 60; // 30分

let continuousSeconds = 0;
let heartbeatIntervalId = null;
let isBlocked = false;
let isBreakShowing = false;

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

// YouTubeで動画が再生中であるか確認
function isVideoPlaying() {
  const videos = document.querySelectorAll('video');
  for (const video of videos) {
    if (!video.paused && !video.ended && video.readyState > 2) {
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
}

// デイリー制限オーバーレイの削除
function removeBlockOverlay() {
  const overlay = document.getElementById('yt-break-reminder-block-overlay');
  if (overlay) overlay.remove();
  isBlocked = false;
}

// 休憩促進オーバーレイの表示
function showBreakOverlay() {
  if (isBreakShowing) return;
  isBreakShowing = true;
  pauseAllVideos();
  
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
  const countdownInterval = setInterval(() => {
    remainingSeconds--;
    const btn = document.getElementById('ybr-resume-btn');
    if (btn) {
      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        btn.textContent = '視聴を再開する';
        btn.disabled = false;
        btn.classList.add('active');
      } else {
        btn.textContent = `休憩中... (${remainingSeconds}秒)`;
      }
    } else {
      clearInterval(countdownInterval);
    }
  }, 1000);
  
  // 再開ボタンのイベント
  document.addEventListener('click', function handleResume(e) {
    if (e.target && e.target.id === 'ybr-resume-btn' && !e.target.disabled) {
      removeBreakOverlay();
      document.removeEventListener('click', handleResume);
    }
  });
}

// 休憩促進オーバーレイの削除
function removeBreakOverlay() {
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
init();
