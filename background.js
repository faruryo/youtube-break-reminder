const DEFAULT_LIMIT_SECONDS = 90 * 60; // デフォルト1.5時間
const DEFAULT_BREAK_SECONDS = 30 * 60; // デフォルト30分

// インストール時に初期設定を保存
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['limitSeconds', 'breakIntervalSeconds', 'todaySeconds', 'lastActiveDate', 'continuousSeconds', 'lastHeartbeatTime', 'resetHour']);
  
  const updates = {};
  if (data.limitSeconds === undefined) updates.limitSeconds = DEFAULT_LIMIT_SECONDS;
  if (data.breakIntervalSeconds === undefined) updates.breakIntervalSeconds = DEFAULT_BREAK_SECONDS;
  if (data.todaySeconds === undefined) updates.todaySeconds = 0;
  if (data.continuousSeconds === undefined) updates.continuousSeconds = 0;
  if (data.lastHeartbeatTime === undefined) updates.lastHeartbeatTime = 0;
  if (data.resetHour === undefined) updates.resetHour = 4; // デフォルト朝4時
  
  const finalResetHour = updates.resetHour !== undefined ? updates.resetHour : (data.resetHour !== undefined ? data.resetHour : 4);
  const businessToday = getBusinessDateString(finalResetHour);
  if (data.lastActiveDate === undefined) updates.lastActiveDate = businessToday;
  
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  
  const finalToday = updates.todaySeconds !== undefined ? updates.todaySeconds : (data.todaySeconds || 0);
  const finalLimit = updates.limitSeconds !== undefined ? updates.limitSeconds : (data.limitSeconds || DEFAULT_LIMIT_SECONDS);
  await updateBadge(finalToday, finalLimit);
});

// リセット時刻を考慮した基準日の日付文字列を取得 (YYYY-MM-DD)
function getBusinessDateString(resetHour = 4) {
  const d = new Date();
  const currentHour = d.getHours();
  
  // 現在時刻が設定されたリセット時刻未満なら、カレンダー上の前日の日付にする
  if (currentHour < resetHour) {
    d.setDate(d.getDate() - 1);
  }
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// バッジ表示を更新する関数
async function updateBadge(todaySeconds, limitSeconds) {
  const remaining = limitSeconds - todaySeconds;
  if (remaining <= 0) {
    await chrome.action.setBadgeText({ text: 'LMT' });
    await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // 赤背景
  } else {
    const remainingMinutes = Math.ceil(remaining / 60);
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      await chrome.action.setBadgeText({ text: `${hours}h` });
    } else {
      await chrome.action.setBadgeText({ text: `${remainingMinutes}m` });
    }
    
    // 残り時間に応じて色を変える (15分未満でオレンジ、それ以上は緑)
    if (remainingMinutes < 15) {
      await chrome.action.setBadgeBackgroundColor({ color: '#FFA500' });
    } else {
      await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    }
  }
}

// 日付が変わっているかチェックし、変わっていればリセットする関数
async function checkAndResetDate() {
  const { lastActiveDate, limitSeconds = DEFAULT_LIMIT_SECONDS, resetHour = 4 } = await chrome.storage.local.get(['lastActiveDate', 'limitSeconds', 'resetHour']);
  const businessToday = getBusinessDateString(resetHour);
  
  if (lastActiveDate !== businessToday) {
    await chrome.storage.local.set({
      todaySeconds: 0,
      continuousSeconds: 0, // 連続視聴もリセット
      lastActiveDate: businessToday
    });
    await updateBadge(0, limitSeconds);
    return true;
  }
  return false;
}

// 連続利用時間のタイムアウト判定とリセットを行うヘルパー関数
async function checkAndResetContinuous() {
  const now = Date.now();
  const data = await chrome.storage.local.get(['continuousSeconds', 'lastHeartbeatTime']);
  const lastHeartbeatTime = data.lastHeartbeatTime || 0;
  
  // 最後のハートビートから60秒以上空いていたら、連続視聴時間をリセット
  if (lastHeartbeatTime > 0 && (now - lastHeartbeatTime > 60 * 1000)) {
    await chrome.storage.local.set({
      continuousSeconds: 0,
      lastHeartbeatTime: 0
    });
    return 0;
  }
  return data.continuousSeconds || 0;
}

let lastIncrementTime = 0;

// メッセージハンドラ
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'HEARTBEAT') {
    (async () => {
      try {
        await checkAndResetDate();
        
        const now = Date.now();
        
        // 950ms未満の重複したハートビート（複数ウィンドウが並んでいる場合など）は無視して、現在の状態を返す
        if (lastIncrementTime > 0 && (now - lastIncrementTime < 950)) {
          const data = await chrome.storage.local.get(['todaySeconds', 'limitSeconds', 'continuousSeconds']);
          const todaySeconds = data.todaySeconds || 0;
          const limitSeconds = data.limitSeconds || DEFAULT_LIMIT_SECONDS;
          const continuousSeconds = data.continuousSeconds || 0;
          const limitExceeded = todaySeconds >= limitSeconds;
          
          sendResponse({ success: true, todaySeconds, continuousSeconds, limitExceeded });
          return;
        }
        
        lastIncrementTime = now;
        
        // タイムアウトによるリセットを確認
        let continuousSeconds = await checkAndResetContinuous();
        
        const data = await chrome.storage.local.get(['todaySeconds', 'limitSeconds']);
        const todaySeconds = (data.todaySeconds || 0) + 1; // 1秒加算
        continuousSeconds += 1;
        const limitSeconds = data.limitSeconds || DEFAULT_LIMIT_SECONDS;
        
        await chrome.storage.local.set({ 
          todaySeconds,
          continuousSeconds,
          lastHeartbeatTime: now
        });
        await updateBadge(todaySeconds, limitSeconds);
        
        const limitExceeded = todaySeconds >= limitSeconds;
        sendResponse({ success: true, todaySeconds, continuousSeconds, limitExceeded });
      } catch (err) {
        console.error('Error in HEARTBEAT handling:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // 非同期レスポンスを有効化
  }
  
  if (message.type === 'GET_STATUS') {
    (async () => {
      try {
        await checkAndResetDate();
        // ポップアップを開いた際にもタイムアウトを即座に反映させる
        const continuousSeconds = await checkAndResetContinuous();
        
        const data = await chrome.storage.local.get(['todaySeconds', 'limitSeconds', 'breakIntervalSeconds']);
        sendResponse({
          todaySeconds: data.todaySeconds || 0,
          limitSeconds: data.limitSeconds || DEFAULT_LIMIT_SECONDS,
          breakIntervalSeconds: data.breakIntervalSeconds || DEFAULT_BREAK_SECONDS,
          continuousSeconds: continuousSeconds
        });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
  
  if (message.type === 'RESET_CONTINUOUS') {
    (async () => {
      try {
        await chrome.storage.local.set({ 
          continuousSeconds: 0,
          lastHeartbeatTime: 0
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
  
  if (message.type === 'UPDATE_SETTINGS') {
    (async () => {
      try {
        const data = await chrome.storage.local.get(['todaySeconds', 'limitSeconds']);
        await updateBadge(data.todaySeconds || 0, message.limitSeconds || data.limitSeconds || DEFAULT_LIMIT_SECONDS);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
  }
});

if (typeof module !== 'undefined') {
  module.exports = {
    getBusinessDateString,
    checkAndResetDate,
    checkAndResetContinuous,
    DEFAULT_LIMIT_SECONDS,
    DEFAULT_BREAK_SECONDS
  };
}
