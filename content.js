let todaySeconds = 0;
let limitSeconds = 90 * 60; // 1.5時間
let breakIntervalSeconds = 30 * 60; // 30分
let todayExtendedSeconds = 0;
let todayExtensionCount = 0;
let maxExtensionsPerDay = 1;
let extensionMinutes = 30;

let continuousSeconds = 0;
let heartbeatIntervalId = null;
let isBlocked = false;
let isBreakShowing = false;
let isDebugEnabled = false;

let shouldResumeVideo = false;
let pausedVideosToResume = [];
let breakCountdownInterval = null;
let breakKeydownListener = null;
let breakClickListener = null;
let blockKeydownListener = null;
// ブロック画面やチャレンジを描き直すたびに進める。古いチャレンジが予約した再描画を無効にするため
let challengeGeneration = 0;

// 予約時と同じチャレンジが表示されている間だけ fn を実行する
function scheduleInChallenge(fn, ms) {
  const generation = challengeGeneration;
  setTimeout(() => {
    if (generation === challengeGeneration) fn();
  }, ms);
}

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
    todayExtendedSeconds = status.todayExtendedSeconds || 0;
    todayExtensionCount = status.todayExtensionCount || 0;
    maxExtensionsPerDay = status.maxExtensionsPerDay !== undefined ? status.maxExtensionsPerDay : 1;
    extensionMinutes = status.extensionMinutes || 30;
  }
  
  // ストレージからデバッグモード設定を取得
  const data = await chrome.storage.local.get(['isDebugEnabled']);
  isDebugEnabled = !!data.isDebugEnabled;

  // 初期状態で既に制限時間を超えているか確認
  if (todaySeconds >= limitSeconds + todayExtendedSeconds) {
    showBlockOverlay();
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
      if (changes.todayExtendedSeconds) {
        todayExtendedSeconds = changes.todayExtendedSeconds.newValue || 0;
        if (isBlocked && !changes.todaySeconds) {
          // 手元の todaySeconds は古い可能性があるため、解除判定は background の最新値で行う（取得失敗時はブロック維持）
          getStatusFromBackground().then((status) => {
            if (!status || status.error) return;
            todaySeconds = status.todaySeconds;
            limitSeconds = status.limitSeconds;
            todayExtendedSeconds = status.todayExtendedSeconds;
            checkDailyLimit();
          });
        } else {
          checkDailyLimit();
        }
      }
      if (changes.todayExtensionCount) {
        todayExtensionCount = changes.todayExtensionCount.newValue || 0;
        updateBlockOverlayUI();
      }
      if (changes.maxExtensionsPerDay) {
        maxExtensionsPerDay = changes.maxExtensionsPerDay.newValue !== undefined ? changes.maxExtensionsPerDay.newValue : 1;
        updateBlockOverlayUI();
      }
      if (changes.extensionMinutes) {
        extensionMinutes = changes.extensionMinutes.newValue || 30;
        updateBlockOverlayUI();
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
          if (response.todayExtendedSeconds !== undefined) todayExtendedSeconds = response.todayExtendedSeconds;
          if (response.todayExtensionCount !== undefined) todayExtensionCount = response.todayExtensionCount;
          if (response.maxExtensionsPerDay !== undefined) maxExtensionsPerDay = response.maxExtensionsPerDay;
          if (response.extensionMinutes !== undefined) extensionMinutes = response.extensionMinutes;
          
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
  const paused = [];
  videos.forEach(video => {
    if (!video.paused) {
      video.pause();
      paused.push(video);
    }
  });
  return paused;
}

// 動画の自動再生（ブロック時はフォールバック無効で元から再生中だった要素のみ再開、休憩後はフォールバック許可）
function resumeVideos(allowFallback = true) {
  let resumed = false;
  if (pausedVideosToResume && pausedVideosToResume.length > 0) {
    pausedVideosToResume.forEach(video => {
      const isConnected = typeof document.contains === 'function' ? document.contains(video) : true;
      if (isConnected && video.paused) {
        video.play().catch(err => {
          console.warn('Failed to auto-play video:', err);
        });
        resumed = true;
      }
    });
    pausedVideosToResume = [];
  }

  // 休憩オーバーレイの再開ボタン押下時など、明示的に許可された場合のみフォールバック
  if (!resumed && allowFallback) {
    const mainVideo = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (mainVideo && mainVideo.paused) {
      mainVideo.play().catch(err => {
        console.warn('Failed to auto-play video:', err);
      });
    }
  }
}

// デイリー制限のチェック
function checkDailyLimit() {
  const effectiveLimit = limitSeconds + todayExtendedSeconds;
  if (todaySeconds >= effectiveLimit) {
    showBlockOverlay();
  } else if (isBlocked && todaySeconds < effectiveLimit) {
    // 制限時間が引き上げられたりリセット・延長された場合は解除
    removeBlockOverlay();
  }
}

// 連続視聴制限（休憩）のチェック
function checkIntervalBreak() {
  if (continuousSeconds >= breakIntervalSeconds) {
    showBreakOverlay();
  }
}

// スクロールおよびメディア操作に関わるキー
const SCROLL_AND_MEDIA_KEYS = new Set([
  'Space', ' ',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'PageUp', 'PageDown', 'Home', 'End',
  'MediaPlayPause', 'MediaTrackNext', 'MediaTrackPrevious', 'MediaStop'
]);

function isScrollOrMediaKey(e) {
  if (!e) return false;
  if (SCROLL_AND_MEDIA_KEYS.has(e.code) || SCROLL_AND_MEDIA_KEYS.has(e.key)) {
    return true;
  }
  const code = e.code || '';
  const key = e.key || '';
  return code.startsWith('Media') || key.startsWith('Media') || code.startsWith('Audio') || key.startsWith('Audio');
}

// キーの長押し（repeat）が解除後に漏れてスクロールや意図しない再生を起こさないよう、keyupまたはblurまで遮断
function blockKeyUntilRelease(releasedCode, releasedKey) {
  const cleanup = () => {
    document.removeEventListener('keydown', handleReleasingKey, true);
    document.removeEventListener('keyup', handleReleasingKey, true);
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', cleanup);
    }
  };

  const handleReleasingKey = (e) => {
    // codeが存在する場合は物理キー(Enter vs NumpadEnter等)で厳密に照合
    const matches = releasedCode ? e.code === releasedCode : (releasedKey && e.key === releasedKey);
    if (matches) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.type === 'keyup') {
        cleanup();
      }
    }
  };

  document.addEventListener('keydown', handleReleasingKey, true);
  document.addEventListener('keyup', handleReleasingKey, true);
  if (typeof window !== 'undefined') {
    window.addEventListener('blur', cleanup, { once: true });
  }
}

// デイリー制限オーバーレイ表示中のキー入力ハンドラ
function handleBlockKeydown(e) {
  const target = e.target;
  const overlay = document.getElementById('yt-break-reminder-block-overlay');
  const isInsideOverlay = overlay && (
    (typeof overlay.contains === 'function' ? overlay.contains(target) : false) ||
    target === overlay
  );
  // オーバーレイ内部の要素（ボタンや入力欄など）に対するキーボード操作はキャプチャ段階で遮断しない
  // （要素自身へイベントを届け、入力やEnter判定、Tabキー移動を正常動作させるため）
  if (isInsideOverlay) {
    return;
  }

  // スクロール・メディア操作キーは修飾キー（Ctrl+Homeなど）が付いていても確実に遮断
  if (isScrollOrMediaKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  // ブラウザのショートカット（Cmd+..., Ctrl+..., Alt+...）は除外
  if (e.metaKey || e.ctrlKey || e.altKey) {
    return;
  }

  // 背後へのキー入力を遮断
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
}

// デイリー制限オーバーレイのデフォルトカード描画
function renderBlockDefaultUI(card) {
  challengeGeneration++;
  card.classList.remove('ybr-challenge-active');
  const canExtend = maxExtensionsPerDay === -1 || todayExtensionCount < maxExtensionsPerDay;
  let extendHtml = '';

  if (maxExtensionsPerDay === 0) {
    extendHtml = `<div class="ybr-no-extend-msg">⚠️ 延長機能は設定で無効化されています</div>`;
  } else if (canExtend) {
    const badgeText = maxExtensionsPerDay === -1
      ? '本日あと ∞回 延長可能'
      : `本日あと ${maxExtensionsPerDay - todayExtensionCount}回 延長可能`;
    extendHtml = `
      <div class="ybr-extension-section">
        <span class="ybr-extension-badge">${badgeText}</span>
        <button id="ybr-start-challenge-btn" class="ybr-challenge-btn">☕ ${extensionMinutes}分延長チャレンジに挑戦する</button>
        <p class="ybr-challenge-subtext">※ランダムな試練をクリアすると今日だけ${extensionMinutes}分延長されます</p>
      </div>
    `;
  } else {
    extendHtml = `
      <div class="ybr-no-extend-msg">
        本日の延長枠（${maxExtensionsPerDay}回）をすべて使い切りました。<br>
        明日のリセットをお楽しみに！
      </div>
    `;
  }

  card.innerHTML = `
    <div class="ybr-icon">⏳</div>
    <h1>本日のYouTubeは終了です</h1>
    <p>今日の視聴・ブラウジング時間が制限時間（${formatTime(limitSeconds + todayExtendedSeconds)}）に達しました。</p>
    <p class="ybr-subtext">今日やりたかった他のことに時間を使いましょう！</p>
    ${extendHtml}
  `;

  const startBtn = typeof card.querySelector === 'function' ? card.querySelector('#ybr-start-challenge-btn') : null;
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      startRandomChallenge(card);
    });
  }
}

// オーバーレイ表示更新
function updateBlockOverlayUI() {
  const overlay = document.getElementById('yt-break-reminder-block-overlay');
  if (!overlay) return;
  const card = overlay.querySelector('.ybr-card');
  if (!card) return;
  if (!card.classList.contains('ybr-challenge-active')) {
    renderBlockDefaultUI(card);
  }
}

// 試練クリア時の共通処理
function handleChallengeClear(card) {
  card.innerHTML = `
    <div class="ybr-clear-view">
      <div class="ybr-clear-icon">⏳</div>
      <div class="ybr-clear-title">試練クリア！</div>
      <div class="ybr-clear-msg">延長を反映しています...</div>
    </div>
  `;

  chrome.runtime.sendMessage({ type: 'EXTEND_TIME' }, (response) => {
    if (response && response.success) {
      todayExtendedSeconds = response.todayExtendedSeconds;
      todayExtensionCount = response.todayExtensionCount;
      if (response.todaySeconds !== undefined) todaySeconds = response.todaySeconds;
      const effectiveLimit = limitSeconds + todayExtendedSeconds;
      const isStillExceeded = response.limitExceeded !== undefined
        ? response.limitExceeded
        : (todaySeconds >= effectiveLimit);
      const addedMins = response.extensionMinutes || extensionMinutes;

      if (!isStillExceeded) {
        card.innerHTML = `
          <div class="ybr-clear-view">
            <div class="ybr-clear-icon">🎉</div>
            <div class="ybr-clear-title">試練クリア！</div>
            <div class="ybr-clear-msg">${addedMins}分 延長されました。<br>${shouldResumeVideo ? '動画を再開します...' : '制限を解除しました。'}</div>
          </div>
        `;

        setTimeout(() => {
          // 待機中に利用時間が増加または設定上限が引き下げられ、超過状態になっていないか再確認
          const currentEffectiveLimit = limitSeconds + todayExtendedSeconds;
          if (todaySeconds >= currentEffectiveLimit) {
            card.innerHTML = `
              <div class="ybr-clear-view">
                <div class="ybr-clear-icon">🎉</div>
                <div class="ybr-clear-title">試練クリア！</div>
                <div class="ybr-clear-msg">${addedMins}分 延長されましたが、利用時間が新しい上限（${formatTime(currentEffectiveLimit)}）を超過しているため、引き続き制限中です。</div>
                <button id="ybr-back-to-block-btn" class="ybr-challenge-btn" style="margin-top: 16px;">戻る</button>
              </div>
            `;
            const backBtn = card.querySelector('#ybr-back-to-block-btn');
            if (backBtn) {
              backBtn.addEventListener('click', () => {
                renderBlockDefaultUI(card);
              });
            }
            return;
          }

          removeBlockOverlay();
          if (shouldResumeVideo) {
            resumeVideos(false);
          } else {
            pausedVideosToResume = [];
          }
        }, 1200);
      } else {
        card.innerHTML = `
          <div class="ybr-clear-view">
            <div class="ybr-clear-icon">🎉</div>
            <div class="ybr-clear-title">試練クリア！</div>
            <div class="ybr-clear-msg">${addedMins}分 延長されましたが、本日の利用時間が新しい上限（${formatTime(effectiveLimit)}）を超過しているため、引き続き制限中です。</div>
            <button id="ybr-back-to-block-btn" class="ybr-challenge-btn" style="margin-top: 16px;">戻る</button>
          </div>
        `;
        const backBtn = card.querySelector('#ybr-back-to-block-btn');
        if (backBtn) {
          backBtn.addEventListener('click', () => {
            renderBlockDefaultUI(card);
          });
        }
      }
    } else {
      const reasonMsg = (response && response.message) || '延長処理に失敗しました。本日の上限に達した可能性があります。';
      card.innerHTML = `
        <div class="ybr-clear-view">
          <div class="ybr-clear-icon">⚠️</div>
          <div class="ybr-clear-title">延長できませんでした</div>
          <div class="ybr-clear-msg">${reasonMsg}</div>
          <button id="ybr-back-to-block-btn" class="ybr-challenge-btn" style="margin-top: 16px;">戻る</button>
        </div>
      `;
      const backBtn = card.querySelector('#ybr-back-to-block-btn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          renderBlockDefaultUI(card);
        });
      }
    }
  });
}

// チャレンジヘッダー生成
function createChallengeHeader(title) {
  return `
    <div class="ybr-challenge-header">
      <div class="ybr-challenge-title-group">
        <div class="ybr-challenge-tag">RANDOM CHALLENGE</div>
        <div class="ybr-challenge-name">${title}</div>
      </div>
      <button class="ybr-cancel-btn" id="ybr-challenge-cancel-btn">諦めて戻る</button>
    </div>
  `;
}

// 1. 宣誓タイピング
function renderTypingChallenge(card) {
  const phrases = [
    `本当にあと${extensionMinutes}分必要です。これを見終わったら作業に戻ります。`,
    `YouTubeのアルゴリズムに操られるな。自分の意思で見るのだ。`,
    `今日できることを明日に延ばすな。でもあと${extensionMinutes}分だけ。`,
    `時間は有限です。この${extensionMinutes}分を心から大切に使います。`,
    `私は自らの選択でYouTubeを延長し、必ず切り上げます。`
  ];
  const targetText = phrases[Math.floor(Math.random() * phrases.length)];

  card.innerHTML = `
    ${createChallengeHeader('✍️ 宣誓タイピング')}
    <p class="ybr-challenge-desc">以下の文章を正確に入力してください（コピペ不可）</p>
    <div class="ybr-typing-target" id="ybr-typing-target">${targetText}</div>
    <input type="text" class="ybr-typing-input" id="ybr-typing-input" placeholder="ここに入力..." autocomplete="off" spellcheck="false">
    <div class="ybr-typing-stats">
      <span id="ybr-typing-count">0 / ${targetText.length} 文字</span>
      <span id="ybr-typing-match" style="color: #8c7e74;">入力中...</span>
    </div>
  `;

  const cancelBtn = card.querySelector('#ybr-challenge-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => renderBlockDefaultUI(card));

  const input = card.querySelector('#ybr-typing-input');
  const countEl = card.querySelector('#ybr-typing-count');
  const matchEl = card.querySelector('#ybr-typing-match');

  if (input) {
    input.addEventListener('paste', (e) => e.preventDefault()); // コピペ防止
    input.addEventListener('input', () => {
      const val = input.value;
      if (countEl) countEl.textContent = `${val.length} / ${targetText.length} 文字`;

      if (val === targetText) {
        if (matchEl) {
          matchEl.textContent = '一致！クリア！';
          matchEl.style.color = '#78ab83';
        }
        input.disabled = true;
        setTimeout(() => handleChallengeClear(card), 400);
      } else if (targetText.startsWith(val)) {
        if (matchEl) {
          matchEl.textContent = '入力中...';
          matchEl.style.color = '#8c7e74';
        }
      } else {
        if (matchEl) {
          matchEl.textContent = '文字が違います';
          matchEl.style.color = '#e74c3c';
        }
      }
    });
    setTimeout(() => input.focus(), 50);
  }
}

// 2. 脳トレ暗算（3問連続）
function renderMathChallenge(card) {
  let step = 1;

  function generateQuestion(s) {
    if (s === 1) {
      const a = Math.floor(Math.random() * 50) + 15;
      const b = Math.floor(Math.random() * 45) + 15;
      return { formula: `${a} + ${b}`, ans: a + b };
    } else if (s === 2) {
      const a = Math.floor(Math.random() * 60) + 35;
      const b = Math.floor(Math.random() * 30) + 12;
      return { formula: `${a} - ${b}`, ans: a - b };
    } else {
      const a = Math.floor(Math.random() * 8) + 12;
      const b = Math.floor(Math.random() * 7) + 3;
      return { formula: `${a} × ${b}`, ans: a * b };
    }
  }

  let currentQ = generateQuestion(step);

  function updateView() {
    card.innerHTML = `
      ${createChallengeHeader('🧠 脳トレ暗算 (3連続正解)')}
      <div class="ybr-math-qnum">第 ${step} / 3 問</div>
      <div class="ybr-math-formula">${currentQ.formula} = ?</div>
      <div class="ybr-math-input-group">
        <input type="number" class="ybr-math-input" id="ybr-math-input" placeholder="答え">
        <button class="ybr-action-btn" id="ybr-math-submit">回答</button>
      </div>
      <div class="ybr-feedback-msg" id="ybr-math-feedback"></div>
    `;

    const cancelBtn = card.querySelector('#ybr-challenge-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => renderBlockDefaultUI(card));

    const input = card.querySelector('#ybr-math-input');
    const submitBtn = card.querySelector('#ybr-math-submit');
    const feedback = card.querySelector('#ybr-math-feedback');

    const checkAnswer = () => {
      const userAns = parseInt(input.value, 10);
      if (userAns === currentQ.ans) {
        step++;
        if (step > 3) {
          handleChallengeClear(card);
        } else {
          currentQ = generateQuestion(step);
          updateView();
        }
      } else {
        feedback.className = 'ybr-feedback-msg error';
        feedback.textContent = '不正解！第1問からやり直しです';
        input.value = '';
        step = 1;
        currentQ = generateQuestion(step);
        scheduleInChallenge(() => updateView(), 900);
      }
    };

    if (submitBtn) submitBtn.addEventListener('click', checkAnswer);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkAnswer();
      });
      setTimeout(() => input.focus(), 50);
    }
  }

  updateView();
}

// 3. 数字タッチゲーム（1〜16）
function renderTouchChallenge(card) {
  let target = 1;
  const numbers = Array.from({ length: 16 }, (_, i) => i + 1);
  // シャッフル
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }

  function updateView() {
    card.innerHTML = `
      ${createChallengeHeader('🔢 数字タッチ (1〜16)')}
      <div class="ybr-touch-target-banner">次は <span>${target}</span> を押してください</div>
      <div class="ybr-touch-grid" id="ybr-touch-grid">
        ${numbers.map(num => `
          <button class="ybr-touch-tile ${num < target ? 'cleared' : ''}" data-num="${num}">${num}</button>
        `).join('')}
      </div>
      <div class="ybr-feedback-msg" id="ybr-touch-feedback"></div>
    `;

    const cancelBtn = card.querySelector('#ybr-challenge-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => renderBlockDefaultUI(card));

    const tiles = card.querySelectorAll('.ybr-touch-tile');
    const feedback = card.querySelector('#ybr-touch-feedback');

    tiles.forEach(tile => {
      tile.addEventListener('click', () => {
        const num = parseInt(tile.getAttribute('data-num'), 10);
        if (num === target) {
          target++;
          if (target > 16) {
            handleChallengeClear(card);
          } else {
            tile.classList.add('cleared');
            const bannerSpan = card.querySelector('.ybr-touch-target-banner span');
            if (bannerSpan) bannerSpan.textContent = target;
          }
        } else {
          tile.classList.add('wrong');
          if (feedback) {
            feedback.className = 'ybr-feedback-msg error';
            feedback.textContent = 'ミス！1からやり直しです';
          }
          scheduleInChallenge(() => {
            renderTouchChallenge(card);
          }, 600);
        }
      });
    });
  }

  updateView();
}

// 4. ストループ色あてクイズ（3問連続）
function renderStroopChallenge(card) {
  let step = 1;
  const colorList = [
    { text: '赤', color: '#e74c3c' },
    { text: '青', color: '#3498db' },
    { text: '緑', color: '#2ecc71' },
    { text: '黄', color: '#f1c40f' }
  ];

  function generateQuestion() {
    const textIdx = Math.floor(Math.random() * colorList.length);
    let colorIdx = Math.floor(Math.random() * colorList.length);
    // 文字と色は不一致にする
    while (colorIdx === textIdx) {
      colorIdx = Math.floor(Math.random() * colorList.length);
    }
    return {
      word: colorList[textIdx].text,
      displayColor: colorList[colorIdx].color,
      correctAnswer: colorList[colorIdx].text
    };
  }

  let currentQ = generateQuestion();

  function updateView() {
    card.innerHTML = `
      ${createChallengeHeader('🎨 色あてテスト (文字の「色」は何色？)')}
      <div class="ybr-math-qnum">第 ${step} / 3 問</div>
      <div class="ybr-stroop-word" style="color: ${currentQ.displayColor};">${currentQ.word}</div>
      <div class="ybr-stroop-options">
        ${colorList.map(c => `
          <button class="ybr-stroop-btn" data-color="${c.text}">${c.text}</button>
        `).join('')}
      </div>
      <div class="ybr-feedback-msg" id="ybr-stroop-feedback"></div>
    `;

    const cancelBtn = card.querySelector('#ybr-challenge-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => renderBlockDefaultUI(card));

    const btns = card.querySelectorAll('.ybr-stroop-btn');
    const feedback = card.querySelector('#ybr-stroop-feedback');

    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const selected = btn.getAttribute('data-color');
        if (selected === currentQ.correctAnswer) {
          step++;
          if (step > 3) {
            handleChallengeClear(card);
          } else {
            currentQ = generateQuestion();
            updateView();
          }
        } else {
          if (feedback) {
            feedback.className = 'ybr-feedback-msg error';
            feedback.textContent = '不正解！第1問からやり直しです';
          }
          step = 1;
          currentQ = generateQuestion();
          scheduleInChallenge(() => updateView(), 700);
        }
      });
    });
  }

  updateView();
}

// 5. 逃げるボタン捕獲（5回クリック）
function renderCatchChallenge(card) {
  let count = 0;

  card.innerHTML = `
    ${createChallengeHeader('🎯 逃げるボタン捕獲')}
    <p class="ybr-challenge-desc">逃げ回るボタンを5回捕獲してください (捕獲: <span id="ybr-catch-count">0</span> / 5)</p>
    <div class="ybr-catch-arena" id="ybr-catch-arena">
      <button class="ybr-catch-target-btn" id="ybr-catch-target" style="top: 40%; left: 40%;">捕まえて！</button>
    </div>
  `;

  const cancelBtn = card.querySelector('#ybr-challenge-cancel-btn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => renderBlockDefaultUI(card));

  const targetBtn = card.querySelector('#ybr-catch-target');
  const countEl = card.querySelector('#ybr-catch-count');

  function jumpButton() {
    const top = Math.floor(Math.random() * 70) + 10;
    const left = Math.floor(Math.random() * 70) + 10;
    targetBtn.style.top = `${top}%`;
    targetBtn.style.left = `${left}%`;
  }

  if (targetBtn) {
    // マウスが近づくとたまに逃げる
    targetBtn.addEventListener('mouseenter', () => {
      if (Math.random() < 0.45) {
        jumpButton();
      }
    });

    targetBtn.addEventListener('click', () => {
      count++;
      if (countEl) countEl.textContent = count;
      if (count >= 5) {
        handleChallengeClear(card);
      } else {
        targetBtn.textContent = `あと ${5 - count}回！`;
        jumpButton();
      }
    });
  }
}

// ランダムチャレンジ開始
function startRandomChallenge(card, forceType = null) {
  challengeGeneration++;
  card.classList.add('ybr-challenge-active');
  const types = ['typing', 'math', 'touch', 'stroop', 'catch'];
  const type = forceType || types[Math.floor(Math.random() * types.length)];

  switch (type) {
    case 'typing':
      renderTypingChallenge(card);
      break;
    case 'math':
      renderMathChallenge(card);
      break;
    case 'touch':
      renderTouchChallenge(card);
      break;
    case 'stroop':
      renderStroopChallenge(card);
      break;
    case 'catch':
      renderCatchChallenge(card);
      break;
    default:
      renderTypingChallenge(card);
  }
}

// デイリー制限オーバーレイの表示
function showBlockOverlay() {
  if (isBlocked) return;
  isBlocked = true;
  
  // 入力欄等にフォーカスが残っていれば外す
  if (document.activeElement && typeof document.activeElement.blur === 'function') {
    document.activeElement.blur();
  }
  
  // ブロック開始時に再生中だった動画要素を保持して一時停止
  pausedVideosToResume = pauseAllVideos();
  // ブロック開始時に実際に動画が再生中だった場合のみ、解除時に再開する
  shouldResumeVideo = pausedVideosToResume.length > 0;
  
  // 既存のオーバーレイを削除
  removeBreakOverlay();
  
  const overlay = document.createElement('div');
  overlay.id = 'yt-break-reminder-block-overlay';

  // オーバーレイ内部でのキー入力（文字入力、Enter、Tab等）がYouTube側のグローバルハンドラへ
  // バブリングして背後の動画操作等を誘発しないよう、オーバーレイ上でバブリングを止める
  if (typeof overlay.addEventListener === 'function') {
    overlay.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
  }

  const card = document.createElement('div');
  card.className = 'ybr-card';
  overlay.appendChild(card);
  renderBlockDefaultUI(card);

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

  // 計測が開始されていない場合は開始
  if (!heartbeatIntervalId) {
    startHeartbeat();
  }
}

// 休憩オーバーレイ表示中のキー入力ハンドラ
function handleBreakKeydown(e) {
  const btn = document.getElementById('ybr-resume-btn');
  const isCountingDown = btn && btn.disabled;

  const isSpace = e.code === 'Space' || e.key === ' ' || e.keyCode === 32;
  const isEnter = e.code === 'Enter' || e.key === 'Enter' || e.keyCode === 13;

  if (isCountingDown) {
    // スクロールキーは修飾キー付き（Shift+Space, Ctrl+Home等）でも遮断
    if (isScrollOrMediaKey(e)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return;
    }

    // ブラウザショートカットは許可
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // カウントダウン中は動画操作やスクロールを防ぐためキー入力を遮断
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return;
  }

  // カウントダウン終了後: Space または Enter による再開
  if (isSpace || isEnter) {
    // ブラウザの修飾キー付き操作（Cmd+Spaceなど）は再開トリガーにしない
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    // YouTubeのデフォルトショートカットやスクロール、二重発火を防止
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (btn && !btn.disabled) {
      // SpaceまたはEnterの長押し（repeat）が解除後に漏れないよう、keyupまたはblurまでガード
      blockKeyUntilRelease(e.code, e.key);
      resumeFromBreak();
    }
    return;
  }

  // カウントダウン終了後も、オーバーレイ表示中はスクロール・メディアキーを遮断
  if (isScrollOrMediaKey(e)) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }
}

// 休憩オーバーレイを解除し、動画再生を再開
function resumeFromBreak() {
  removeBreakOverlay();
  if (shouldResumeVideo) {
    resumeVideos(true);
  } else {
    pausedVideosToResume = [];
  }
}

// 休憩促進オーバーレイの表示
function showBreakOverlay() {
  if (isBreakShowing) return;
  isBreakShowing = true;

  // 休憩開始時に再生中だった動画要素を保持して一時停止
  pausedVideosToResume = pauseAllVideos();
  // 休憩開始時に実際に動画が再生中だった場合のみ、解除時に再開する
  shouldResumeVideo = pausedVideosToResume.length > 0;

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
  if (typeof MutationObserver === 'undefined') return;
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
    isScrollOrMediaKey,
    formatTime,
    renderBlockDefaultUI,
    startRandomChallenge,
    handleChallengeClear,
    renderTypingChallenge,
    renderMathChallenge,
    renderTouchChallenge,
    renderStroopChallenge,
    renderCatchChallenge,
    init
  };
}
