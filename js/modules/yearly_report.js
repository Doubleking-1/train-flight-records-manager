// ===================================
// 年度报告模块 (Yearly Report Module)
// ===================================
//
// 负责年度出行报告的生成、展示和导出
// - 弹窗管理
// - 报告内容生成
// - 保存为图片

console.log('[Yearly Report Module] 加载中...');

// ---- DOM 元素 ----
const _reportBtn = document.getElementById('yearlyReportBtn');
const _reportOverlay = document.getElementById('reportModalOverlay');
const _reportCloseBtn = document.getElementById('closeReportBtn');
const _reportGenBtn = document.getElementById('generateReportBtn');
const _reportYearSel = document.getElementById('reportYearSelect');
const _reportContent = document.getElementById('reportContent');
const _reportSaveBtn = document.getElementById('saveReportImgBtn');

// ---- 打开报告弹窗 ----

function openYearlyReport() {
  _reportOverlay.style.display = 'flex';
  // Populate years
  const years = [...new Set(records.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort().reverse();
  _reportYearSel.innerHTML = '<option value="">选择年份...</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  // Reset content
  _reportContent.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">请选择年份并点击生成</div>';
  _reportSaveBtn.style.display = 'none';
}

// ---- 生成报告 ----

function generateYearlyReport() {
  try {
    const year = _reportYearSel.value;
    if (!year) {
      alert('请先选择年份');
      return;
    }

    const yearRecords = records.filter(r => r.date && r.date.startsWith(year));
    if (yearRecords.length === 0) {
      _reportContent.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">该年份没有出行记录</div>';
      _reportSaveBtn.style.display = 'none';
      return;
    }

    // Calculate Stats
    const totalTrips = yearRecords.length;
    const totalDistance = yearRecords.reduce((sum, r) => sum + (r.distance || 0), 0);
    const totalCost = yearRecords.reduce((sum, r) => sum + (r.cost || 0), 0);
    const totalDurationMins = yearRecords.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);
    const totalDurationHrs = (totalDurationMins / 60).toFixed(1);

    // Top Destination
    const cityCounts = {};
    yearRecords.forEach(r => {
      if (r.endCity) cityCounts[r.endCity] = (cityCounts[r.endCity] || 0) + 1;
    });
    const topCity = Object.keys(cityCounts).sort((a, b) => cityCounts[b] - cityCounts[a])[0] || '未知';

    // Most Active Month
    const monthCounts = {};
    yearRecords.forEach(r => {
      if (r.date) {
        const m = parseInt(r.date.substring(5, 7), 10);
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
    });
    const topMonth = Object.keys(monthCounts).sort((a, b) => monthCounts[b] - monthCounts[a])[0];
    const topMonthCount = monthCounts[topMonth] || 0;

    // Longest Distance Trip
    const longestTrip = [...yearRecords].sort((a, b) => (b.distance || 0) - (a.distance || 0))[0];

    // Most Expensive Trip
    const mostExpensiveTrip = [...yearRecords].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0];

    // Longest Duration Trip
    const longestDurationTrip = [...yearRecords].sort((a, b) => parseDurationToMinutes(b.duration) - parseDurationToMinutes(a.duration))[0];

    // First & Last Trip
    const sortedByDate = [...yearRecords].sort((a, b) => {
      const da = new Date((a.date || '') + ' ' + (a.time || '00:00'));
      const db = new Date((b.date || '') + ' ' + (b.time || '00:00'));
      return da - db;
    });
    const firstTrip = sortedByDate[0];
    const lastTrip = sortedByDate[sortedByDate.length - 1];

    // Helper to format trip
    const fmtTrip = (r) => `${r.date.substring(5)} ${r.startCity}→${r.endCity}`;
    const fmtTripStation = (r) => `${r.date.substring(5)} ${r.startStation} (${r.startCity}) → ${r.endStation} (${r.endCity})`;

    // Render HTML
    const html = `
      <div class="report-container">
        <div class="report-header">
          <div class="report-title">年度出行报告</div>
          <div class="report-year">${year}</div>
          <div class="report-subtitle">我的足迹与回忆</div>
        </div>

        <div class="report-section">
          <div class="report-stat-grid">
            <div class="report-stat-item">
              <div class="report-stat-val">${totalTrips}</div>
              <div class="report-stat-label">出行次数</div>
            </div>
            <div class="report-stat-item">
              <div class="report-stat-val">${Math.round(totalDistance).toLocaleString()}</div>
              <div class="report-stat-label">总里程 (km)</div>
            </div>
            <div class="report-stat-item">
              <div class="report-stat-val">${totalDurationHrs}</div>
              <div class="report-stat-label">在路上 (小时)</div>
            </div>
            <div class="report-stat-item">
              <div class="report-stat-val">${Math.round(totalCost).toLocaleString()}</div>
              <div class="report-stat-label">总花费 (元)</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
            <div style="background:rgba(102, 126, 234, 0.1); padding:15px; border-radius:8px; text-align:center;">
              <div style="font-size:12px; color:#666;">最钟情的城市</div>
              <div style="font-size:20px; font-weight:bold; color:#333; margin:5px 0;">${topCity}</div>
              <div style="font-size:11px; color:#999;">到达 ${cityCounts[topCity]} 次</div>
            </div>
            <div style="background:rgba(118, 75, 162, 0.1); padding:15px; border-radius:8px; text-align:center;">
              <div style="font-size:12px; color:#666;">最繁忙的月份</div>
              <div style="font-size:20px; font-weight:bold; color:#333; margin:5px 0;">${topMonth}月</div>
              <div style="font-size:11px; color:#999;">出行 ${topMonthCount} 次</div>
            </div>
          </div>
        </div>

        <div class="report-section">
          <h4 style="margin:0 0 15px 0; text-align:center; color:#333; font-size:16px;">年度之最</h4>

          <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; font-size:13px;">
            <span style="color:#666;">📏 最远的一次</span>
            <span style="font-weight:bold; color:#333;">${longestTrip ? fmtTrip(longestTrip) : '-'}</span>
            <span style="color:#667eea;">${longestTrip ? longestTrip.distance + 'km' : ''}</span>
          </div>

          <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; font-size:13px;">
            <span style="color:#666;">💰 最贵的一次</span>
            <span style="font-weight:bold; color:#333;">${mostExpensiveTrip ? fmtTrip(mostExpensiveTrip) : '-'}</span>
            <span style="color:#f6ad55;">¥${mostExpensiveTrip ? mostExpensiveTrip.cost : ''}</span>
          </div>

          <div style="margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; font-size:13px;">
            <span style="color:#666;">⏳ 最久的一次</span>
            <span style="font-weight:bold; color:#333;">${longestDurationTrip ? fmtTrip(longestDurationTrip) : '-'}</span>
            <span style="color:#48bb78;">${longestDurationTrip ? longestDurationTrip.duration : ''}</span>
          </div>
        </div>

        <div class="report-section" style="background:#fafafa;">
          <h4 style="margin:0 0 15px 0; text-align:center; color:#333; font-size:16px;">时光轨迹</h4>

          <div style="position:relative; padding-left:20px; border-left:2px solid #ddd; margin-left:10px;">
            <div style="position:absolute; left:-6px; top:0; width:10px; height:10px; background:#667eea; border-radius:50%;"></div>
            <div style="margin-bottom:20px;">
              <div style="font-size:12px; color:#999;">${year}年的开始</div>
              <div style="font-size:14px; font-weight:bold; color:#333;">${firstTrip ? fmtTripStation(firstTrip) : '-'}</div>
              <div style="font-size:12px; color:#666;">${firstTrip ? (firstTrip.trainNo || firstTrip.trainType) : ''}</div>
            </div>

            <div style="position:absolute; left:-6px; bottom:0; width:10px; height:10px; background:#764ba2; border-radius:50%;"></div>
            <div>
              <div style="font-size:12px; color:#999;">${year}年的收官</div>
              <div style="font-size:14px; font-weight:bold; color:#333;">${lastTrip ? fmtTripStation(lastTrip) : '-'}</div>
              <div style="font-size:12px; color:#666;">${lastTrip ? (lastTrip.trainNo || lastTrip.trainType) : ''}</div>
            </div>
          </div>
        </div>

        <div class="report-footer">
          <div class="report-logo">Train & Flight Records</div>
          <div>Generated by Your Personal Travel Assistant</div>
          <div>${new Date().toLocaleDateString()}</div>
        </div>
      </div>
    `;

    _reportContent.innerHTML = html;
    _reportSaveBtn.style.display = 'block';

  } catch (error) {
    console.error('生成年度报告失败:', error);
    alert('生成年度报告时发生错误: ' + error.message);
  }
}

// ---- 保存为图片 ----

function saveReportImage() {
  if (!window.html2canvas) {
    alert('html2canvas 库未加载，无法生成图片');
    return;
  }

  const btn = _reportSaveBtn;
  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;

  html2canvas(document.querySelector('.report-container'), {
    scale: 2,
    useCORS: true,
    backgroundColor: null
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Travel_Report_${_reportYearSel.value}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    btn.textContent = '💾 保存为图片';
    btn.disabled = false;
  }).catch(err => {
    console.error('截图失败:', err);
    alert('生成图片失败');
    btn.textContent = '💾 保存为图片';
    btn.disabled = false;
  });
}

// ---- 事件绑定 ----

if (_reportBtn) {
  _reportBtn.addEventListener('click', openYearlyReport);
}
if (_reportCloseBtn) {
  _reportCloseBtn.addEventListener('click', () => {
    _reportOverlay.style.display = 'none';
  });
}
if (_reportGenBtn) {
  _reportGenBtn.addEventListener('click', generateYearlyReport);
}
if (_reportSaveBtn) {
  _reportSaveBtn.addEventListener('click', saveReportImage);
}

// ESC 关闭已迁移到 app.js


console.log('[Yearly Report Module] ✅ 加载完成');
