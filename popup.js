// YouTube Break Reminder Popup Logic

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
  
  if (baseHolidays.has(key)) {
    return true;
  }
  
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

// 基準時刻を考慮したDateオブジェクトを取得
function getBusinessDate(resetHour = 4) {
  const d = new Date();
  const currentHour = d.getHours();
  if (currentHour < resetHour) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

// 日付に応じた設定キーを取得
function getActiveLimitKey(date) {
  if (isHoliday(date)) {
    return 'limitSeconds_H';
  }
  return `limitSeconds_${date.getDay()}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const circle = document.querySelector('.progress-ring__circle');
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;

  // サークルの初期化
  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  const currentText = document.getElementById('current-time');
  const remainingText = document.getElementById('remaining-time');
  const continuousText = document.getElementById('continuous-time');
  
  // 曜日・祝日別入力項目の収集
  const limitInputs = {};
  for (let i = 0; i <= 6; i++) {
    limitInputs[`hours_${i}`] = document.getElementById(`limit-hours-${i}`);
    limitInputs[`minutes_${i}`] = document.getElementById(`limit-minutes-${i}`);
  }
  limitInputs['hours_H'] = document.getElementById('limit-hours-H');
  limitInputs['minutes_H'] = document.getElementById('limit-minutes-H');

  const breakIntervalInput = document.getElementById('break-interval');
  const resetHourInput = document.getElementById('reset-hour');
  const debugEnabledInput = document.getElementById('debug-enabled');
  
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');

  // 設定とステータスをロードして表示を更新
  async function loadStatus() {
    const keys = [
      'todaySeconds',
      'limitSeconds',
      'breakIntervalSeconds',
      'continuousSeconds',
      'resetHour',
      'isDebugEnabled'
    ];
    for (let i = 0; i <= 6; i++) {
      keys.push(`limitSeconds_${i}`);
    }
    keys.push('limitSeconds_H');

    const data = await chrome.storage.local.get(keys);

    const todaySeconds = data.todaySeconds || 0;
    const limitSeconds = data.limitSeconds || 90 * 60; // デフォルト1.5時間
    const breakIntervalSeconds = data.breakIntervalSeconds || 30 * 60; // デフォルト30分
    const continuousSeconds = data.continuousSeconds || 0;
    const resetHour = data.resetHour !== undefined ? data.resetHour : 4; // デフォルト朝4時

    // 進捗率の計算
    const progress = Math.min(todaySeconds / limitSeconds, 1);
    setProgress(progress);

    // テキスト表示の更新
    currentText.textContent = formatTimeShort(todaySeconds);
    
    const remaining = limitSeconds - todaySeconds;
    if (remaining <= 0) {
      remainingText.textContent = '制限時間に達しました';
      remainingText.style.color = 'var(--accent-color)';
    } else {
      remainingText.textContent = formatTimeLong(remaining);
      remainingText.style.color = '#dca163'; // 落ち着いたキャラメルカラー
    }

    // 連続視聴時間の更新
    const breakRemaining = Math.max(breakIntervalSeconds - continuousSeconds, 0);
    continuousText.textContent = `${formatTimeShort(continuousSeconds)} (休憩まで ${formatTimeShort(breakRemaining)})`;

    // 曜日別制限時間の入力欄セット（フォーカスしていない場合のみ）
    let isAnyLimitFocused = false;
    for (let i = 0; i <= 6; i++) {
      if (document.activeElement === limitInputs[`hours_${i}`] || document.activeElement === limitInputs[`minutes_${i}`]) {
        isAnyLimitFocused = true;
        break;
      }
    }
    if (document.activeElement === limitInputs['hours_H'] || document.activeElement === limitInputs['minutes_H']) {
      isAnyLimitFocused = true;
    }

    if (!isAnyLimitFocused) {
      const baseLimit = data.limitSeconds !== undefined ? data.limitSeconds : 90 * 60;
      for (let i = 0; i <= 6; i++) {
        const val = data[`limitSeconds_${i}`] !== undefined ? data[`limitSeconds_${i}`] : baseLimit;
        limitInputs[`hours_${i}`].value = Math.floor(val / 3600);
        limitInputs[`minutes_${i}`].value = Math.floor((val % 3600) / 60);
      }
      const valH = data['limitSeconds_H'] !== undefined ? data['limitSeconds_H'] : baseLimit;
      limitInputs['hours_H'].value = Math.floor(valH / 3600);
      limitInputs['minutes_H'].value = Math.floor((valH % 3600) / 60);
    }
    
    if (document.activeElement !== breakIntervalInput) {
      breakIntervalInput.value = Math.floor(breakIntervalSeconds / 60);
    }

    if (document.activeElement !== resetHourInput) {
      resetHourInput.value = resetHour;
    }

    if (document.activeElement !== debugEnabledInput) {
      debugEnabledInput.checked = !!data.isDebugEnabled;
    }
  }

  // サークル進捗アニメーション
  function setProgress(percent) {
    const offset = circumference - (percent * circumference);
    circle.style.strokeDashoffset = offset;
  }

  // 時間フォーマット (例: 12s, 1m 24s, 1h 24m 12s)
  function formatTimeShort(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  // 残り時間の詳細フォーマット (例: 1時間32分15秒)
  function formatTimeLong(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}時間 ${mins}分 ${secs}秒`;
    }
    if (mins > 0) {
      return `${mins}分 ${secs}秒`;
    }
    return `${secs}秒`;
  }

  // 設定の保存
  saveBtn.addEventListener('click', async () => {
    const breakMins = parseInt(breakIntervalInput.value, 10) || 30;
    const resetH = parseInt(resetHourInput.value, 10) || 4;

    const finalBreakMins = Math.max(5, Math.min(180, breakMins));
    const finalResetH = Math.max(0, Math.min(23, resetH));
    const breakIntervalSeconds = finalBreakMins * 60;

    // 各曜日・祝日の設定を取得・バリデーションして秒数に変換
    const newLimits = {};
    for (let i = 0; i <= 6; i++) {
      const h = parseInt(limitInputs[`hours_${i}`].value, 10) || 0;
      const m = parseInt(limitInputs[`minutes_${i}`].value, 10) || 0;
      const valH = Math.max(0, Math.min(23, h));
      const valM = Math.max(0, Math.min(59, m));
      let limitSec = (valH * 3600) + (valM * 60);
      newLimits[`limitSeconds_${i}`] = limitSec === 0 ? 60 : limitSec; // 0秒制限は防ぐ
    }
    const hH = parseInt(limitInputs['hours_H'].value, 10) || 0;
    const mH = parseInt(limitInputs['minutes_H'].value, 10) || 0;
    const valHH = Math.max(0, Math.min(23, hH));
    const valMH = Math.max(0, Math.min(59, mH));
    let limitSecH = (valHH * 3600) + (valMH * 60);
    newLimits['limitSeconds_H'] = limitSecH === 0 ? 60 : limitSecH;

    // 現在の日付に応じて適用されるアクティブ制限時間を計算
    const businessDate = getBusinessDate(finalResetH);
    const key = getActiveLimitKey(businessDate);
    const activeLimitSeconds = newLimits[key];

    const saveObj = {
      ...newLimits,
      limitSeconds: activeLimitSeconds,
      breakIntervalSeconds,
      resetHour: finalResetH,
      isDebugEnabled: debugEnabledInput.checked
    };

    await chrome.storage.local.set(saveObj);

    // バックグラウンドに設定変更を通知してバッジを更新させる
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      limitSeconds: activeLimitSeconds
    });

    // 画面の更新
    await loadStatus();

    // 保存ステータスの表示
    saveStatus.classList.add('show');
    setTimeout(() => {
      saveStatus.classList.remove('show');
    }, 2000);
  });

  // デバッグチェックボックスの変更を即時保存
  debugEnabledInput.addEventListener('change', async () => {
    await chrome.storage.local.set({
      isDebugEnabled: debugEnabledInput.checked
    });
  });

  // ロード時実行
  await loadStatus();
  
  // 1秒ごとに表示を同期（ポップアップを開いている間のリアルタイム更新）
  setInterval(loadStatus, 1000);
});
