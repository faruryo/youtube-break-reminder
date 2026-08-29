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

// 日付オブジェクトから YYYY-MM-DD 文字列を取得
function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

// 残り時間の詳細フォーマット (例: 1時間 32分 15秒)
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

// 日本語時間フォーマット (例: 1時間30分, 45分, 0分)
function formatTimeJapanese(seconds) {
  if (!seconds || seconds <= 0) return '0分';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}時間${mins > 0 ? mins + '分' : ''}`;
  }
  if (mins > 0) {
    return `${mins}分`;
  }
  return `${secs}秒`;
}

// 時間帯別配列からピーク時間帯を算出
function findPeakHour(hourlyArray) {
  if (!hourlyArray || !hourlyArray.length) {
    return { hour: -1, maxSeconds: 0 };
  }
  let maxSeconds = 0;
  let peakHour = -1;
  for (let h = 0; h < hourlyArray.length; h++) {
    const sec = hourlyArray[h] || 0;
    if (sec > maxSeconds) {
      maxSeconds = sec;
      peakHour = h;
    }
  }
  return { hour: peakHour, maxSeconds };
}

// 日別データの集計
function aggregateDailyHistory(dateStr, usageHistory = {}) {
  const dayData = usageHistory[dateStr] || { hourly: new Array(24).fill(0), total: 0 };
  const hourly = Array.isArray(dayData.hourly) && dayData.hourly.length === 24 
    ? [...dayData.hourly] 
    : new Array(24).fill(0);
  const total = dayData.total !== undefined ? dayData.total : hourly.reduce((a, b) => a + b, 0);
  return { dateStr, hourly, total };
}

// 週別データの集計（月曜始まりの7日間）
function aggregateWeeklyHistory(dateObj, usageHistory = {}) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const dayOfWeek = d.getDay(); // 0(日)..6(土)
  // 月曜日を起点にする (日曜日=0なら -6、月曜日=1なら 0、火曜日=2なら -1 ...)
  const diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const days = [];
  const hourlyCombined = new Array(24).fill(0);
  let total = 0;
  const dayNames = ['月', '火', '水', '木', '金', '土', '日'];

  for (let i = 0; i < 7; i++) {
    const current = new Date(monday);
    current.setDate(monday.getDate() + i);
    const dateKey = formatDateKey(current);
    const dayData = aggregateDailyHistory(dateKey, usageHistory);

    for (let h = 0; h < 24; h++) {
      hourlyCombined[h] += dayData.hourly[h];
    }
    total += dayData.total;

    days.push({
      dateStr: dateKey,
      dayLabel: dayNames[i],
      dateNumber: current.getDate(),
      total: dayData.total
    });
  }

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startLabel = `${monday.getMonth() + 1}/${monday.getDate()}`;
  const endLabel = `${sunday.getMonth() + 1}/${sunday.getDate()}`;
  const average = Math.round(total / 7);

  return {
    startLabel,
    endLabel,
    mondayDateStr: formatDateKey(monday),
    sundayDateStr: formatDateKey(sunday),
    days,
    hourly: hourlyCombined,
    total,
    average
  };
}

// 月別データの集計
function aggregateMonthlyHistory(dateObj, usageHistory = {}) {
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0..11
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  const hourlyCombined = new Array(24).fill(0);
  let total = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const current = new Date(year, month, d);
    const dateKey = formatDateKey(current);
    const dayData = aggregateDailyHistory(dateKey, usageHistory);

    for (let h = 0; h < 24; h++) {
      hourlyCombined[h] += dayData.hourly[h];
    }
    total += dayData.total;

    days.push({
      dateStr: dateKey,
      dayNumber: d,
      total: dayData.total
    });
  }

  const average = Math.round(total / daysInMonth);

  return {
    year,
    month: month + 1,
    daysInMonth,
    days,
    hourly: hourlyCombined,
    total,
    average
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  // --- タブ要素 ---
  const tabTimer = document.getElementById('tab-timer');
  const tabReport = document.getElementById('tab-report');
  const timerSection = document.getElementById('timer-section');
  const reportSection = document.getElementById('report-section');

  // --- タイマー・設定用要素 ---
  const circle = document.querySelector('.progress-ring__circle');
  const radius = circle.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;

  circle.style.strokeDasharray = `${circumference} ${circumference}`;
  circle.style.strokeDashoffset = circumference;

  const currentText = document.getElementById('current-time');
  const remainingText = document.getElementById('remaining-time');
  const continuousText = document.getElementById('continuous-time');
  
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

  // --- レポート用要素 ---
  const viewDailyBtn = document.getElementById('view-daily');
  const viewWeeklyBtn = document.getElementById('view-weekly');
  const viewMonthlyBtn = document.getElementById('view-monthly');
  const prevDateBtn = document.getElementById('prev-date-btn');
  const nextDateBtn = document.getElementById('next-date-btn');
  const todayBtn = document.getElementById('today-btn');
  const dateDisplayLabel = document.getElementById('date-display-label');

  const summaryTitleTotal = document.getElementById('summary-title-total');
  const reportTotalTime = document.getElementById('report-total-time');
  const summaryTitleAvg = document.getElementById('summary-title-avg');
  const reportAvgTime = document.getElementById('report-avg-time');
  const reportPeakHour = document.getElementById('report-peak-hour');

  const hourlyChartSub = document.getElementById('hourly-chart-sub');
  const hourlyChart = document.getElementById('hourly-chart');
  const hourlyTooltip = document.getElementById('hourly-tooltip');

  const trendChartCard = document.getElementById('trend-chart-card');
  const trendChartTitle = document.getElementById('trend-chart-title');
  const trendChart = document.getElementById('trend-chart');
  const trendTooltip = document.getElementById('trend-tooltip');

  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // レポート状態変数
  let activeTab = 'timer'; // 'timer' | 'report'
  let reportView = 'daily'; // 'daily' | 'weekly' | 'monthly'
  let selectedDate = new Date();

  // --- タブ切り替え処理 ---
  function switchTab(tabName) {
    activeTab = tabName;
    if (tabName === 'timer') {
      tabTimer.classList.add('active');
      tabReport.classList.remove('active');
      timerSection.style.display = 'block';
      reportSection.style.display = 'none';
      loadStatus();
    } else {
      tabReport.classList.add('active');
      tabTimer.classList.remove('active');
      timerSection.style.display = 'none';
      reportSection.style.display = 'block';
      renderReport();
    }
  }

  tabTimer.addEventListener('click', () => switchTab('timer'));
  tabReport.addEventListener('click', () => switchTab('report'));

  // --- 期間切り替え処理 ---
  viewDailyBtn.addEventListener('click', () => {
    reportView = 'daily';
    viewDailyBtn.classList.add('active');
    viewWeeklyBtn.classList.remove('active');
    viewMonthlyBtn.classList.remove('active');
    renderReport();
  });

  viewWeeklyBtn.addEventListener('click', () => {
    reportView = 'weekly';
    viewWeeklyBtn.classList.add('active');
    viewDailyBtn.classList.remove('active');
    viewMonthlyBtn.classList.remove('active');
    renderReport();
  });

  viewMonthlyBtn.addEventListener('click', () => {
    reportView = 'monthly';
    viewMonthlyBtn.classList.add('active');
    viewDailyBtn.classList.remove('active');
    viewWeeklyBtn.classList.remove('active');
    renderReport();
  });

  // --- 日付ナビゲーション処理 ---
  prevDateBtn.addEventListener('click', () => {
    if (reportView === 'daily') {
      selectedDate.setDate(selectedDate.getDate() - 1);
    } else if (reportView === 'weekly') {
      selectedDate.setDate(selectedDate.getDate() - 7);
    } else if (reportView === 'monthly') {
      selectedDate.setMonth(selectedDate.getMonth() - 1);
    }
    renderReport();
  });

  nextDateBtn.addEventListener('click', () => {
    const today = new Date();
    if (reportView === 'daily') {
      selectedDate.setDate(selectedDate.getDate() + 1);
    } else if (reportView === 'weekly') {
      selectedDate.setDate(selectedDate.getDate() + 7);
    } else if (reportView === 'monthly') {
      selectedDate.setMonth(selectedDate.getMonth() + 1);
    }
    // 未来の日付に行き過ぎないように調整
    if (selectedDate > today) {
      selectedDate = new Date();
    }
    renderReport();
  });

  todayBtn.addEventListener('click', () => {
    selectedDate = new Date();
    renderReport();
  });

  // --- レポート描画処理 ---
  async function renderReport() {
    const data = await chrome.storage.local.get(['usageHistory', 'limitSeconds', 'todaySeconds']);
    const usageHistory = data.usageHistory || {};
    const todayStr = formatDateKey(new Date());

    if (reportView === 'daily') {
      const dateStr = formatDateKey(selectedDate);
      const isToday = dateStr === todayStr;
      const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
      const dayName = dayNames[selectedDate.getDay()];
      
      dateDisplayLabel.textContent = `${selectedDate.getFullYear()}/${selectedDate.getMonth() + 1}/${selectedDate.getDate()} (${dayName})${isToday ? ' [今日]' : ''}`;
      todayBtn.textContent = '今日';

      const dailyData = aggregateDailyHistory(dateStr, usageHistory);
      
      summaryTitleTotal.textContent = '総視聴時間';
      reportTotalTime.textContent = formatTimeJapanese(dailyData.total);

      summaryTitleAvg.textContent = '制限時間 / 目安';
      const limitSec = data.limitSeconds || 90 * 60;
      if (dailyData.total > 0) {
        const percent = Math.min(100, Math.round((dailyData.total / limitSec) * 100));
        reportAvgTime.textContent = `${formatTimeJapanese(limitSec)} (${percent}%)`;
      } else {
        reportAvgTime.textContent = formatTimeJapanese(limitSec);
      }

      const peak = findPeakHour(dailyData.hourly);
      if (peak.maxSeconds > 0) {
        reportPeakHour.textContent = `${peak.hour}:00〜${peak.hour + 1}:00 (${formatTimeJapanese(peak.maxSeconds)})`;
      } else {
        reportPeakHour.textContent = '視聴なし';
      }

      hourlyChartSub.textContent = '24時間分布';
      renderHourlyBars(dailyData.hourly, peak.hour);
      trendChartCard.style.display = 'none';

    } else if (reportView === 'weekly') {
      const weeklyData = aggregateWeeklyHistory(selectedDate, usageHistory);
      dateDisplayLabel.textContent = `${weeklyData.startLabel} 〜 ${weeklyData.endLabel}`;
      todayBtn.textContent = '今週';

      summaryTitleTotal.textContent = '週間総視聴時間';
      reportTotalTime.textContent = formatTimeJapanese(weeklyData.total);

      summaryTitleAvg.textContent = '1日平均';
      reportAvgTime.textContent = formatTimeJapanese(weeklyData.average);

      const peak = findPeakHour(weeklyData.hourly);
      if (peak.maxSeconds > 0) {
        reportPeakHour.textContent = `${peak.hour}:00〜${peak.hour + 1}:00 (${formatTimeJapanese(peak.maxSeconds)})`;
      } else {
        reportPeakHour.textContent = '視聴なし';
      }

      hourlyChartSub.textContent = '週累計の時間帯分布';
      renderHourlyBars(weeklyData.hourly, peak.hour);

      // 週間の日別トレンド表示
      trendChartCard.style.display = 'block';
      trendChartTitle.textContent = '曜日別の推移 (月〜日)';
      renderWeeklyTrendBars(weeklyData.days, todayStr);

    } else if (reportView === 'monthly') {
      const monthlyData = aggregateMonthlyHistory(selectedDate, usageHistory);
      dateDisplayLabel.textContent = `${monthlyData.year}年 ${monthlyData.month}月`;
      todayBtn.textContent = '今月';

      summaryTitleTotal.textContent = '月間総視聴時間';
      reportTotalTime.textContent = formatTimeJapanese(monthlyData.total);

      summaryTitleAvg.textContent = '1日平均';
      reportAvgTime.textContent = formatTimeJapanese(monthlyData.average);

      const peak = findPeakHour(monthlyData.hourly);
      if (peak.maxSeconds > 0) {
        reportPeakHour.textContent = `${peak.hour}:00〜${peak.hour + 1}:00 (${formatTimeJapanese(peak.maxSeconds)})`;
      } else {
        reportPeakHour.textContent = '視聴なし';
      }

      hourlyChartSub.textContent = '月累計の時間帯分布';
      renderHourlyBars(monthlyData.hourly, peak.hour);

      // 月間の日別トレンド表示
      trendChartCard.style.display = 'block';
      trendChartTitle.textContent = '日別の推移';
      renderMonthlyTrendBars(monthlyData.days, todayStr);
    }
  }

  // 24時間バーチャートのレンダリング
  function renderHourlyBars(hourlyArray, peakHour) {
    hourlyChart.innerHTML = '';
    const maxVal = Math.max(...hourlyArray, 60); // 最小基準60秒

    hourlyArray.forEach((sec, hour) => {
      const col = document.createElement('div');
      col.className = 'hourly-bar-col';

      const bar = document.createElement('div');
      bar.className = 'hourly-bar';
      if (sec > 0) {
        bar.classList.add('has-data');
        if (hour === peakHour && sec > 0) {
          bar.classList.add('is-peak');
        }
      }

      const heightPercent = sec > 0 ? Math.max(8, (sec / maxVal) * 100) : 3;
      bar.style.height = `${heightPercent}%`;

      col.appendChild(bar);

      // ホバー / クリックイベント
      const showDetails = () => {
        document.querySelectorAll('.hourly-bar-col').forEach(c => c.classList.remove('selected'));
        col.classList.add('selected');
        hourlyTooltip.innerHTML = `<strong>${hour}:00 〜 ${hour + 1}:00</strong> : ${formatTimeJapanese(sec)}`;
      };

      col.addEventListener('mouseenter', showDetails);
      col.addEventListener('click', showDetails);

      hourlyChart.appendChild(col);
    });

    hourlyTooltip.innerHTML = 'バーをタップ/ホバーで時間帯の詳細を表示';
  }

  // 週間日別バーチャートのレンダリング
  function renderWeeklyTrendBars(days, todayStr) {
    trendChart.innerHTML = '';
    const maxVal = Math.max(...days.map(d => d.total), 60);

    days.forEach(day => {
      const col = document.createElement('div');
      col.className = 'trend-bar-col';

      const barWrapper = document.createElement('div');
      barWrapper.className = 'trend-bar-wrapper';

      const bar = document.createElement('div');
      bar.className = 'trend-bar';
      if (day.total > 0) {
        bar.classList.add('has-data');
      }
      if (day.dateStr === todayStr) {
        bar.classList.add('is-today');
      }

      const heightPercent = day.total > 0 ? Math.max(8, (day.total / maxVal) * 100) : 3;
      bar.style.height = `${heightPercent}%`;

      barWrapper.appendChild(bar);
      col.appendChild(barWrapper);

      const label = document.createElement('div');
      label.className = 'trend-bar-label';
      label.textContent = day.dayLabel;
      col.appendChild(label);

      const showDetails = () => {
        document.querySelectorAll('.trend-bar-col').forEach(c => c.classList.remove('selected'));
        col.classList.add('selected');
        trendTooltip.innerHTML = `<strong>${day.dateStr} (${day.dayLabel})</strong> : ${formatTimeJapanese(day.total)}`;
      };

      col.addEventListener('mouseenter', showDetails);
      col.addEventListener('click', showDetails);

      trendChart.appendChild(col);
    });

    trendTooltip.innerHTML = '曜日バーをタップ/ホバーで利用時間を表示';
  }

  // 月間日別バーチャートのレンダリング
  function renderMonthlyTrendBars(days, todayStr) {
    trendChart.innerHTML = '';
    const maxVal = Math.max(...days.map(d => d.total), 60);

    days.forEach(day => {
      const col = document.createElement('div');
      col.className = 'trend-bar-col';

      const barWrapper = document.createElement('div');
      barWrapper.className = 'trend-bar-wrapper';

      const bar = document.createElement('div');
      bar.className = 'trend-bar';
      if (day.total > 0) {
        bar.classList.add('has-data');
      }
      if (day.dateStr === todayStr) {
        bar.classList.add('is-today');
      }

      const heightPercent = day.total > 0 ? Math.max(8, (day.total / maxVal) * 100) : 3;
      bar.style.height = `${heightPercent}%`;

      barWrapper.appendChild(bar);
      col.appendChild(barWrapper);

      const label = document.createElement('div');
      label.className = 'trend-bar-label';
      // 5日ごと、および初日・末日のみ日付数値を表示
      if (day.dayNumber === 1 || day.dayNumber % 5 === 0 || day.dayNumber === days.length) {
        label.textContent = String(day.dayNumber);
      } else {
        label.textContent = '·';
      }
      col.appendChild(label);

      const showDetails = () => {
        document.querySelectorAll('.trend-bar-col').forEach(c => c.classList.remove('selected'));
        col.classList.add('selected');
        trendTooltip.innerHTML = `<strong>${day.dateStr}</strong> : ${formatTimeJapanese(day.total)}`;
      };

      col.addEventListener('mouseenter', showDetails);
      col.addEventListener('click', showDetails);

      trendChart.appendChild(col);
    });

    trendTooltip.innerHTML = '日付バーをタップ/ホバーで利用時間を表示';
  }

  // 履歴データの全消去
  clearHistoryBtn.addEventListener('click', async () => {
    if (confirm('これまでのYouTube利用履歴データをすべて消去しますか？\n（今日のタイマーや制限時間設定は保持されます）')) {
      await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
      await renderReport();
    }
  });

  // --- タイマー・設定のロード ---
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
      newLimits[`limitSeconds_${i}`] = limitSec === 0 ? 60 : limitSec;
    }
    const hH = parseInt(limitInputs['hours_H'].value, 10) || 0;
    const mH = parseInt(limitInputs['minutes_H'].value, 10) || 0;
    const valHH = Math.max(0, Math.min(23, hH));
    const valMH = Math.max(0, Math.min(59, mH));
    let limitSecH = (valHH * 3600) + (valMH * 60);
    newLimits['limitSeconds_H'] = limitSecH === 0 ? 60 : limitSecH;

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

    chrome.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      limitSeconds: activeLimitSeconds
    });

    await loadStatus();

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
  
  // 1秒ごとに表示を同期（タイマー画面を開いている場合）
  setInterval(() => {
    if (activeTab === 'timer') {
      loadStatus();
    }
  }, 1000);
});

if (typeof module !== 'undefined') {
  module.exports = {
    getHolidays,
    isHoliday,
    getBusinessDate,
    getActiveLimitKey,
    formatDateKey,
    formatTimeShort,
    formatTimeLong,
    formatTimeJapanese,
    findPeakHour,
    aggregateDailyHistory,
    aggregateWeeklyHistory,
    aggregateMonthlyHistory
  };
}
