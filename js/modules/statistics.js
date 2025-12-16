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

  const totalTrips = records.length;
  const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalDistance = records.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalMinutes = records.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);

  // 统计城市（仅统计终点城市）
  const cities = new Set();
  records.forEach(r => {
    if (r.endCity && r.endCity.trim()) {
      cities.add(r.endCity.trim());
    } else if (!r.endCity && r.endStation) { // 兼容无城市仅有站名的情况
      cities.add(r.endStation.trim());
    }
  });

  // 找出最远和最近的行程
  const longestTrip = records.reduce((a, r) => (r.distance || 0) > (a.distance || 0) ? r : a, records[0]);

  // 找出时长最长的行程
  const longestDurationTrip = records.reduce((a, r) => parseDurationToMinutes(r.duration) > parseDurationToMinutes(a.duration) ? r : a, records[0]);

  // 找出最贵和最便宜的行程
  const mostExpensive = records.reduce((a, r) => (r.cost || 0) > (a.cost || 0) ? r : a, records[0]);

  // 平均值
  const avgCost = totalTrips > 0 ? (totalCost / totalTrips).toFixed(2) : 0;
  const avgDistance = totalTrips > 0 ? (totalDistance / totalTrips).toFixed(1) : 0;
  const avgDuration = totalTrips > 0 ? formatMinutesToDuration(Math.round(totalMinutes / totalTrips)) : '0分钟';

  // 辅助函数：格式化行程显示
  const fmtTrip = (r) => {
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
}

console.log('[Statistics Module] updateYearlySummary 已加载');

console.log('[Statistics Module] ✅ 全部加载完成');
