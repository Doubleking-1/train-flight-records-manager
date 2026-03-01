// ===================================
// 统计模块 (Statistics Module)
// ===================================
//
// 负责计算和显示统计数据
// - 全时段统计
// - 年度统计
// - 统计面板更新

console.log('[Statistics Module] 加载中...');

// ===========================================
// 1. 全时段统计 (All-Time Summary)
// ===========================================

function updateAllTimeSummary() {
  const container = document.getElementById('allStatsGrid');
  if (!container) return;

  const filteredRecords = records.filter(r => {
    if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
    const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
    return selectedYears.has(year);
  });

  const totalTrips = filteredRecords.length;
  const totalCost = filteredRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalDistance = filteredRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalMinutes = filteredRecords.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);

  // 统计城市（仅统计终点城市）
  const cities = new Set();
  filteredRecords.forEach(r => {
    if (r.endCity && r.endCity.trim()) {
      cities.add(r.endCity.trim());
    } else if (!r.endCity && r.endStation) { // 兼容无城市仅有站名的情况
      cities.add(r.endStation.trim());
    }
  });

  // 找出最远和最近的行程
  const longestTrip = filteredRecords.length ? filteredRecords.reduce((a, r) => (r.distance || 0) > (a.distance || 0) ? r : a, filteredRecords[0]) : null;

  // 找出时长最长的行程
  const longestDurationTrip = filteredRecords.length ? filteredRecords.reduce((a, r) => parseDurationToMinutes(r.duration) > parseDurationToMinutes(a.duration) ? r : a, filteredRecords[0]) : null;

  // 找出最贵和最便宜的行程
  const mostExpensive = filteredRecords.length ? filteredRecords.reduce((a, r) => (r.cost || 0) > (a.cost || 0) ? r : a, filteredRecords[0]) : null;

  // 平均值
  const avgCost = totalTrips > 0 ? (totalCost / totalTrips).toFixed(2) : 0;
  const avgDistance = totalTrips > 0 ? (totalDistance / totalTrips).toFixed(1) : 0;
  const avgDuration = totalTrips > 0 ? formatMinutesToDuration(Math.round(totalMinutes / totalTrips)) : '0分钟';

  // 辅助函数：格式化行程显示
  const fmtTrip = (r) => {
    if (!r) return '无';
    const start = r.startCity || r.startStation;
    const end = r.endCity || r.endStation;
    return `${start} → ${end}`;
  };

  // 生成统计卡片 (4x3 布局)
  container.innerHTML = `
        <!-- 第一行：总量 (Totals) -->
        <div class="stat-card">
          <div class="stat-value">${totalTrips}</div>
          <div class="stat-label">🚩 总行程数</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalDistance.toLocaleString()}</div>
          <div class="stat-label">📏 总里程 (公里)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMinutesToDuration(totalMinutes)}</div>
          <div class="stat-label">⏳ 总乘车时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">¥${totalCost.toFixed(2)}</div>
          <div class="stat-label">💰 总花费</div>
        </div>

        <!-- 第二行：平均/其他 (Averages/Counts) -->
        <div class="stat-card">
          <div class="stat-value">${cities.size}</div>
          <div class="stat-label">🏙️ 到访城市</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDistance}</div>
          <div class="stat-label">📏 平均里程 (km)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDuration}</div>
          <div class="stat-label">⏳ 平均时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">¥${avgCost}</div>
          <div class="stat-label">💰 平均票价</div>
        </div>

        <!-- 第三行：纪录之最 (Records) -->
        <div class="stat-card">
          <div class="stat-value" style="font-size:18px;">${(totalDistance / 40075).toFixed(2)} 圈</div>
          <div class="stat-label">🌍 绕地球圈数</div>
        </div>
        <div class="stat-card interactable-card" id="stat-longest-dist">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestTrip)}</div>
          <div class="stat-label">📏 最远行程 (${longestTrip ? longestTrip.distance : 0} km)</div>
        </div>
        <div class="stat-card interactable-card" id="stat-longest-time">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestDurationTrip)}</div>
          <div class="stat-label">⏳ 最长时长 (${longestDurationTrip ? longestDurationTrip.duration : '0'})</div>
        </div>
        <div class="stat-card interactable-card" id="stat-most-exp">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(mostExpensive)}</div>
          <div class="stat-label">💰 最贵行程 (¥${mostExpensive ? mostExpensive.cost : 0})</div>
        </div>
      `;

  // Bind click events
  document.getElementById('stat-longest-dist').onclick = () => highlightRecord(longestTrip);
  document.getElementById('stat-longest-time').onclick = () => highlightRecord(longestDurationTrip);
  document.getElementById('stat-most-exp').onclick = () => highlightRecord(mostExpensive);

  // 渲染车次类型统计图
  try { renderTrainTypeCharts(filteredRecords, 'all'); } catch (e) { console.warn('[Statistics] 车次类型图渲染失败:', e); }
}

console.log('[Statistics Module] updateAllTimeSummary 已加载');

// ===========================================
// 2. 年度统计 (Yearly Summary)
// ===========================================

function updateYearlySummary(year) {
  const container = document.getElementById('yearlyStatsGrid');
  if (!container || !year) return;

  const yearRecords = records.filter(r => r.date && r.date.startsWith(year));
  const totalTrips = yearRecords.length;
  const totalCost = yearRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalDistance = yearRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalMinutes = yearRecords.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);

  // 统计城市（仅统计终点城市）
  const cities = new Set();
  yearRecords.forEach(r => {
    if (r.endCity && r.endCity.trim()) {
      cities.add(r.endCity.trim());
    } else if (!r.endCity && r.endStation) {
      cities.add(r.endStation.trim());
    }
  });

  // 找出最远和最近的行程 (基于 yearRecords)
  const longestTrip = yearRecords.reduce((a, r) => (r.distance || 0) > (a.distance || 0) ? r : a, yearRecords[0]);

  // 找出时长最长的行程
  const longestDurationTrip = yearRecords.reduce((a, r) => parseDurationToMinutes(r.duration) > parseDurationToMinutes(a.duration) ? r : a, yearRecords[0]);

  // 找出最贵和最便宜的行程
  const mostExpensive = yearRecords.reduce((a, r) => (r.cost || 0) > (a.cost || 0) ? r : a, yearRecords[0]);

  // 平均值
  const avgCost = totalTrips > 0 ? (totalCost / totalTrips).toFixed(2) : 0;
  const avgDistance = totalTrips > 0 ? (totalDistance / totalTrips).toFixed(1) : 0;
  const avgDuration = totalTrips > 0 ? formatMinutesToDuration(Math.round(totalMinutes / totalTrips)) : '0分钟';

  // 辅助函数：格式化行程显示
  const fmtTrip = (r) => {
    if (!r) return '无';
    const start = r.startCity || r.startStation;
    const end = r.endCity || r.endStation;
    return `${start} → ${end}`;
  };

  // 计算占总体比例
  const allTotalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const allTotalDistance = records.reduce((sum, r) => sum + (r.distance || 0), 0);

  // 生成统计卡片 (4x3 布局)
  container.innerHTML = `
        <!-- 第一行：总量 (Totals) -->
        <div class="stat-card">
          <div class="stat-value">${totalTrips}</div>
          <div class="stat-label">🚩 ${year}年总行程</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalDistance.toLocaleString()}</div>
          <div class="stat-label">📏 总里程 (公里)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatMinutesToDuration(totalMinutes)}</div>
          <div class="stat-label">⏳ 总乘车时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">¥${totalCost.toFixed(2)}</div>
          <div class="stat-label">💰 总花费</div>
        </div>

        <!-- 第二行：平均/其他 (Averages/Counts) -->
        <div class="stat-card">
          <div class="stat-value">${cities.size}</div>
          <div class="stat-label">🏙️ 到访城市</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDistance}</div>
          <div class="stat-label">📏 平均里程 (km)</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgDuration}</div>
          <div class="stat-label">⏳ 平均时长</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">¥${avgCost}</div>
          <div class="stat-label">💰 平均票价</div>
        </div>

        <!-- 第三行：纪录之最 (Records) -->
        <div class="stat-card">
          <div class="stat-value" style="font-size:18px;">${(totalDistance / 40075).toFixed(2)} 圈</div>
          <div class="stat-label">🌍 绕地球圈数</div>
        </div>
        <div class="stat-card interactable-card" id="stat-year-longest-dist">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestTrip)}</div>
          <div class="stat-label">📏 最远行程 (${longestTrip ? longestTrip.distance : 0} km)</div>
        </div>
        <div class="stat-card interactable-card" id="stat-year-longest-time">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestDurationTrip)}</div>
          <div class="stat-label">⏳ 最长时长 (${longestDurationTrip ? longestDurationTrip.duration : '0'})</div>
        </div>
        <div class="stat-card interactable-card" id="stat-year-most-exp">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(mostExpensive)}</div>
          <div class="stat-label">💰 最贵行程 (¥${mostExpensive ? mostExpensive.cost : 0})</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${allTotalCost > 0 ? (totalCost / allTotalCost * 100).toFixed(1) : 0}%</div>
          <div class="stat-label">占总花费比例</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${allTotalDistance > 0 ? (totalDistance / allTotalDistance * 100).toFixed(1) : 0}%</div>
          <div class="stat-label">占总里程比例</div>
        </div>
      `;

  // Bind click events
  document.getElementById('stat-year-longest-dist').onclick = () => highlightRecord(longestTrip);
  document.getElementById('stat-year-longest-time').onclick = () => highlightRecord(longestDurationTrip);
  document.getElementById('stat-year-most-exp').onclick = () => highlightRecord(mostExpensive);

  // 渲染车次类型统计图（年度）
  try { renderTrainTypeCharts(yearRecords, 'year'); } catch (e) { console.warn('[Statistics] 年度车次类型图渲染失败:', e); }
}

console.log('[Statistics Module] updateYearlySummary 已加载');

// ===========================================
// 3. 车次类型柱状统计图 (Train Type Bar Charts)
// ===========================================

// Chart instances cache
const _ttCharts = {};

/**
 * 根据车次号首字母判断列车类型
 * G=高铁 D=动车 C=城际 S=市郊 Z=直达 T=特快 K=快速 纯数字=普快 Y=旅游 其他=其他
 */
function getTrainTypeCategory(trainNo) {
  if (!trainNo || !trainNo.trim()) return '其他';
  const first = trainNo.trim().charAt(0).toUpperCase();
  const map = { G: '高铁', D: '动车', C: '城际', S: '市郊', Z: '直达', T: '特快', K: '快速', Y: '旅游' };
  if (map[first]) return map[first];
  if (/^\d/.test(first)) return '普快';
  return '其他';
}

// Ordered category labels
const TRAIN_TYPE_ORDER = ['高铁', '动车', '城际', '市郊', '直达', '特快', '快速', '普快', '旅游', '其他'];

// Colors per category
const TRAIN_TYPE_COLORS = {
  '高铁': 'rgba(66, 133, 244, 0.75)',
  '动车': 'rgba(52, 168, 83, 0.75)',
  '城际': 'rgba(251, 188, 4, 0.75)',
  '市郊': 'rgba(154, 160, 166, 0.75)',
  '直达': 'rgba(234, 67, 53, 0.75)',
  '特快': 'rgba(255, 112, 67, 0.75)',
  '快速': 'rgba(171, 71, 188, 0.75)',
  '普快': 'rgba(121, 85, 72, 0.75)',
  '旅游': 'rgba(0, 188, 212, 0.75)',
  '其他': 'rgba(158, 158, 158, 0.75)'
};

/**
 * 渲染车次类型统计图表
 * @param {Array} recs - 要统计的记录数组
 * @param {string} prefix - canvas ID 前缀: 'all' 或 'year'
 */
function renderTrainTypeCharts(recs, prefix) {
  if (typeof Chart === 'undefined') return;

  const wrapEl = document.getElementById('trainTypeChartsPanel');

  // 仅在火车模式下显示
  if (currentEntity === 'plane' || !recs || recs.length === 0) {
    if (wrapEl) wrapEl.style.display = 'none';
    return;
  }
  if (wrapEl) wrapEl.style.display = 'block';

  // 聚合数据
  const agg = {};
  TRAIN_TYPE_ORDER.forEach(t => { agg[t] = { count: 0, cost: 0, dist: 0, dur: 0 }; });

  recs.forEach(r => {
    const cat = getTrainTypeCategory(r.trainNo);
    agg[cat].count++;
    agg[cat].cost += (r.cost || 0);
    agg[cat].dist += (r.distance || 0);
    agg[cat].dur += parseDurationToMinutes(r.duration);
  });

  // 只显示有数据的类别
  const labels = TRAIN_TYPE_ORDER.filter(t => agg[t].count > 0);
  const counts = labels.map(t => agg[t].count);
  const costs = labels.map(t => Math.round(agg[t].cost));
  const dists = labels.map(t => Math.round(agg[t].dist));
  const durs = labels.map(t => +(agg[t].dur / 60).toFixed(1));
  const bgColors = labels.map(t => TRAIN_TYPE_COLORS[t]);

  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#ccc' : '#666';

  const makeOptions = (unit) => ({
    responsive: true,
    maintainAspectRatio: true,
    layout: { padding: { bottom: 5 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y.toLocaleString()} ${unit}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 }, maxRotation: 0, autoSkip: false }
      },
      y: {
        beginAtZero: true,
        grid: { color: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' },
        ticks: { color: textColor, font: { size: 10 } }
      }
    }
  });

  const chartDefs = [
    { id: 'trainTypeCountChart', data: counts, unit: '次' },
    { id: 'trainTypeCostChart', data: costs, unit: '元' },
    { id: 'trainTypeDistChart', data: dists, unit: 'km' },
    { id: 'trainTypeDurChart', data: durs, unit: '小时' }
  ];

  chartDefs.forEach(def => {
    const canvas = document.getElementById(def.id);
    if (!canvas) return;

    // Destroy previous instance
    if (_ttCharts[def.id]) {
      _ttCharts[def.id].destroy();
      _ttCharts[def.id] = null;
    }

    _ttCharts[def.id] = new Chart(canvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: def.data,
          backgroundColor: bgColors,
          borderWidth: 0,
          borderRadius: 3,
          barPercentage: 0.7
        }]
      },
      options: makeOptions(def.unit)
    });
  });
}

console.log('[Statistics Module] renderTrainTypeCharts 已加载');

console.log('[Statistics Module] ✅ 全部加载完成');

