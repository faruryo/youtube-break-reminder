const DEFAULT_LIMIT_SECONDS = 90 * 60; // デフォルト1.5時間
const DEFAULT_BREAK_SECONDS = 30 * 60; // デフォルト30分

// 日本の祝日（祝日法に基づくもの）を生成する関数
function getHolidays(year) {
  const holidays = new Map();
  
  const add = (month, day) => {
    holidays.set(`${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`, true);
  };
  
  const getNthMonday = (month, n) => {
    const firstDay = new Date(year, month - 1, 1).getDay(); // 0: 日, 1: 月, ...
    const daysToFirstMonday = (1 - firstDay + 7) % 7;
    return 1 + daysToFirstMonday + (n - 1) * 7;
  };
  
  // 固定祝日
  add(1, 1);   // 元日
  add(2, 11);  // 建国記念の日
  add(2, 23);  // 天皇誕生日
  add(4, 29);  // 昭和の日
  add(5, 3);   // 憲法記念日
  add(5, 4);   // みどりの日
  add(5, 5);   // こどもの日
  add(8, 11);  // 山の日
  add(11, 3);  // 文化の日
  add(11, 23); // 勤労感謝の日
  
  // ハッピーマンデー
  add(1, getNthMonday(1, 2));  // 成人の日 (第2月曜)
  add(7, getNthMonday(7, 3));  // 海の日 (第3月曜)
  add(9, getNthMonday(9, 3));  // 敬老の日 (第3月曜)
  add(10, getNthMonday(10, 2)); // スポーツの日 (第2月曜)
  
  // 春分の日・秋分の日の簡易計算式 (2000〜2099年に対応)
  const vernalDay = Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  add(3, vernalDay);
  
  const autumnalDay = Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  add(9, autumnalDay);
  
  return holidays;
}

// 特定の日付が祝日（振替休日・国民の休日を含む）かどうか判定
function isHoliday(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const baseHolidays = getHolidays(year);
  const key = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  
  // 国民の祝日に該当する場合
  if (baseHolidays.has(key)) {
    return true;
  }
  
  // 振替休日の判定
  // 祝日が日曜日に当たるときは、その翌日以降の「祝日でない日」の最初の日を休日とする
  let checkDate = new Date(date);
  while (true) {
    checkDate.setDate(checkDate.getDate() - 1);
    const checkYear = checkDate.getFullYear();
    const checkMonth = checkDate.getMonth() + 1;
    const checkDay = checkDate.getDate();
    const checkKey = `${String(checkMonth).padStart(2, '0')}-${String(checkDay).padStart(2, '0')}`;
    const checkBaseHolidays = getHolidays(checkYear);
    
    if (checkBaseHolidays.has(checkKey)) {
      if (checkDate.getDay() === 0) { // 日曜日が祝日だった！
        return true;
      }
    } else {
      break;
    }
  }
  
  // 国民の休日の判定
  // 前日と翌日の両方が「国民の祝日」である平日は休日とする
  const prevDate = new Date(date);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + 1);
  
  const prevKey = `${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`;
  const nextKey = `${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
  
  const prevHolidays = getHolidays(prevDate.getFullYear());
  const nextHolidays = getHolidays(nextDate.getFullYear());
  
  if (prevHolidays.has(prevKey) && nextHolidays.has(nextKey)) {
    return true;
  }
  
  return false;
}

// 土曜日、日曜日、または祝日であるか判定
function isHolidayOrWeekend(date) {
  const day = date.getDay();
  if (day === 0 || day === 6) {
    return true;
  }
  return isHoliday(date);
}

// 日付に応じた設定キーを取得
function getActiveLimitKey(date) {
  if (isHoliday(date)) {
    return 'limitSeconds_H';
  }
  return `limitSeconds_${date.getDay()}`;
}

// 基準時刻を考慮したDateオブジェクトを取得
function getBusinessDate(resetHour = 4) {
  const d = new Date();
  const currentHour = d.getHours();
  
  if (currentHour < resetHour) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// リセット時刻を考慮した基準日の日付文字列を取得 (YYYY-MM-DD)
function getBusinessDateString(resetHour = 4) {
  const d = getBusinessDate(resetHour);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// 現在適用されるべき制限時間を取得
async function getActiveLimit() {
  const data = await chrome.storage.local.get(['limitSeconds_H', 'limitSeconds_0', 'limitSeconds_1', 'limitSeconds_2', 'limitSeconds_3', 'limitSeconds_4', 'limitSeconds_5', 'limitSeconds_6', 'resetHour']);
  const resetHour = data.resetHour !== undefined ? data.resetHour : 4;
  
  const businessDate = getBusinessDate(resetHour);
  const key = getActiveLimitKey(businessDate);
  
  return data[key] !== undefined ? data[key] : DEFAULT_LIMIT_SECONDS;
}

// インストール時に初期設定を保存
chrome.runtime.onInstalled.addListener(async () => {
  const keys = ['limitSeconds', 'breakIntervalSeconds', 'todaySeconds', 'lastActiveDate', 'continuousSeconds', 'lastHeartbeatTime', 'resetHour', 'isDebugEnabled'];
  for (let i = 0; i <= 6; i++) {
    keys.push(`limitSeconds_${i}`);
  }
  keys.push('limitSeconds_H');
  
  const data = await chrome.storage.local.get(keys);
  
  const updates = {};
  
  // 旧設定からのマイグレーション
  const baseLimit = data.limitSeconds !== undefined ? data.limitSeconds : DEFAULT_LIMIT_SECONDS;
  
  for (let i = 0; i <= 6; i++) {
    if (data[`limitSeconds_${i}`] === undefined) {
      updates[`limitSeconds_${i}`] = baseLimit;
    }
  }
  if (data['limitSeconds_H'] === undefined) {
    updates['limitSeconds_H'] = baseLimit;
  }
  
  if (data.breakIntervalSeconds === undefined) updates.breakIntervalSeconds = DEFAULT_BREAK_SECONDS;
  if (data.todaySeconds === undefined) updates.todaySeconds = 0;
  if (data.continuousSeconds === undefined) updates.continuousSeconds = 0;
  if (data.lastHeartbeatTime === undefined) updates.lastHeartbeatTime = 0;
  if (data.resetHour === undefined) updates.resetHour = 4; // デフォルト朝4時
  if (data.isDebugEnabled === undefined) updates.isDebugEnabled = false; // デフォルト無効
  
  const finalResetHour = updates.resetHour !== undefined ? updates.resetHour : (data.resetHour !== undefined ? data.resetHour : 4);
  const businessToday = getBusinessDateString(finalResetHour);
  if (data.lastActiveDate === undefined) updates.lastActiveDate = businessToday;
  
  if (Object.keys(updates).length > 0) {
    await chrome.storage.local.set(updates);
  }
  
  const activeLimit = await getActiveLimit();
  await chrome.storage.local.set({ limitSeconds: activeLimit });
  
  const finalToday = updates.todaySeconds !== undefined ? updates.todaySeconds : (data.todaySeconds || 0);
  await updateBadge(finalToday, activeLimit);
});

// バッジ表示を更新する関数
async function updateBadge(todaySeconds, limitSeconds) {
  const remaining = limitSeconds - todaySeconds;
  if (remaining <= 0) {
    await chrome.action.setBadgeText({ text: 'LMT' });
    await chrome.action.setBadgeBackgroundColor({ color: '#c02c2c' }); // 落ち着いたレッド
  } else {
    const remainingMinutes = Math.ceil(remaining / 60);
    if (remainingMinutes >= 60) {
      const hours = Math.floor(remainingMinutes / 60);
      await chrome.action.setBadgeText({ text: `${hours}h` });
    } else {
      await chrome.action.setBadgeText({ text: `${remainingMinutes}m` });
    }
    
    // 残り時間に応じて色を変える (15分未満でキャラメル、それ以上は抹茶グリーン)
    if (remainingMinutes < 15) {
      await chrome.action.setBadgeBackgroundColor({ color: '#dca163' });
    } else {
      await chrome.action.setBadgeBackgroundColor({ color: '#5d8c67' });
    }
  }
}

// 日付が変わっているかチェックし、変わっていればリセットする関数
async function checkAndResetDate() {
  const { lastActiveDate, resetHour = 4 } = await chrome.storage.local.get(['lastActiveDate', 'resetHour']);
  const businessToday = getBusinessDateString(resetHour);
  
  if (lastActiveDate !== businessToday) {
    const activeLimit = await getActiveLimit();
    await chrome.storage.local.set({
      todaySeconds: 0,
      continuousSeconds: 0, // 連続視聴もリセット
      lastActiveDate: businessToday,
      limitSeconds: activeLimit
    });
    await updateBadge(0, activeLimit);
    return true;
  }
  return false;
}

// 連続利用時間のタイムアウト判定とリセットを行うヘルパー関数
async function checkAndResetContinuous() {
  const now = Date.now();
  const data = await chrome.storage.local.get(['continuousSeconds', 'lastHeartbeatTime']);
  const lastHeartbeatTime = data.lastHeartbeatTime || 0;
  
  // 最後のハートビートから5分（300秒）以上空いていたら、連続視聴時間をリセット
  if (lastHeartbeatTime > 0 && (now - lastHeartbeatTime > 300 * 1000)) {
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
        
        const data = await chrome.storage.local.get(['todaySeconds', 'limitSeconds', 'lastHeartbeatTime']);
        const lastHeartbeatTime = data.lastHeartbeatTime || 0;
        const limitSeconds = data.limitSeconds || DEFAULT_LIMIT_SECONDS;
        
        let secondsToAdd = 1; // 基本は1秒加算
        
        if (lastHeartbeatTime > 0) {
          const diff = now - lastHeartbeatTime;
          if (diff > 1500) { // 1.5秒以上の間隔が空いた場合（別タブ移動や放置）
            if (diff < 60 * 1000) {
              // 60秒未満の離脱であれば、その間の実時間（秒）をすべて上乗せ加算（往来時の引き継ぎ）
              secondsToAdd = Math.floor(diff / 1000);
            } else {
              // 60秒以上の離脱であれば、猶予期間の「60秒」だけを加算し、あとは停止していたとみなす
              secondsToAdd = 60;
            }
          }
        }
        
        const todaySeconds = (data.todaySeconds || 0) + secondsToAdd;
        continuousSeconds += secondsToAdd;
        
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
    DEFAULT_BREAK_SECONDS,
    getBusinessDate,
    isHolidayOrWeekend,
    isHoliday,
    getHolidays,
    getActiveLimitKey,
    getActiveLimit
  };
}
