// YouTube Break Reminder Popup Logic

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
  
  const hoursInput = document.getElementById('limit-hours');
  const minutesInput = document.getElementById('limit-minutes');
  const breakIntervalInput = document.getElementById('break-interval');
  const resetHourInput = document.getElementById('reset-hour');
  const debugEnabledInput = document.getElementById('debug-enabled');
  
  const saveBtn = document.getElementById('save-btn');
  const saveStatus = document.getElementById('save-status');

  // 設定とステータスをロードして表示を更新
  async function loadStatus() {
    const data = await chrome.storage.local.get([
      'todaySeconds',
      'limitSeconds',
      'breakIntervalSeconds',
      'continuousSeconds',
      'resetHour',
      'isDebugEnabled'
    ]);

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

    // 設定入力欄への値のセット（初回のみ）
    if (document.activeElement !== hoursInput && document.activeElement !== minutesInput) {
      const limitHours = Math.floor(limitSeconds / 3600);
      const limitMins = Math.floor((limitSeconds % 3600) / 60);
      hoursInput.value = limitHours;
      minutesInput.value = limitMins;
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
    const hours = parseInt(hoursInput.value, 10) || 0;
    const minutes = parseInt(minutesInput.value, 10) || 0;
    const breakMins = parseInt(breakIntervalInput.value, 10) || 30;
    const resetH = parseInt(resetHourInput.value, 10) || 4;

    // 最小・最大バリデーション
    const finalHours = Math.max(0, Math.min(23, hours));
    const finalMinutes = Math.max(0, Math.min(59, minutes));
    const finalBreakMins = Math.max(5, Math.min(180, breakMins));
    const finalResetH = Math.max(0, Math.min(23, resetH));

    const limitSeconds = (finalHours * 3600) + (finalMinutes * 60);
    const breakIntervalSeconds = finalBreakMins * 60;

    // 0秒制限は防ぐ
    const validatedLimitSeconds = limitSeconds === 0 ? 60 : limitSeconds;

    await chrome.storage.local.set({
      limitSeconds: validatedLimitSeconds,
      breakIntervalSeconds,
      resetHour: finalResetH,
      isDebugEnabled: debugEnabledInput.checked
    });

    // バックグラウンドに設定変更を通知してバッジを更新させる
    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      limitSeconds: validatedLimitSeconds
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
