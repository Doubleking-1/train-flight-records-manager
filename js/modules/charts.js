// ===================================
// 图表渲染模块 (Charts Module)
// ===================================
//
// 负责趋势图表（年度/月度）、铁路局/航空公司、车型/机型统计图
// 依赖全局: records, parseDurationToMinutes(), getEntityConfig(),
//           currentEntity, updateAllTimeSummary(), updateYearSelect(),
//           updateYearlySummary(), yearSelect, Chart.js

console.log('[Charts Module] 加载中...');

// ---- 图表实例 ----
let tripsChart, distanceChart, costChart, durationChart, bureauChart, typeChart;

function createYearlyCharts(mode = 'yearly', selectedYear = null) {
  if (records.length === 0) return;

  let labels, trips, distances, costs, durations;

  if (mode === 'monthly' && selectedYear) {
    // 月度模式：显示选定年份的12个月的统计
    const yearRecords = records.filter(r => r.date && r.date.substring(0, 4) === selectedYear);

    // 初始化12个月的数据
    const monthlyData = Array.from({ length: 12 }, () => ({
      trips: 0,
      distance: 0,
      cost: 0,
      duration: 0
    }));

    // 统计每个月的数据
    yearRecords.forEach(record => {
      const month = new Date(record.date).getMonth(); // 0-11
      monthlyData[month].trips++;
      monthlyData[month].distance += record.distance || 0;
      monthlyData[month].cost += record.cost || 0;
      monthlyData[month].duration += parseDurationToMinutes(record.duration);
    });

    // 生成标签和数据
    labels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    trips = monthlyData.map(m => m.trips);
    distances = monthlyData.map(m => m.distance);
    costs = monthlyData.map(m => m.cost);
    durations = monthlyData.map(m => Math.round(m.duration / 60)); // 转换为小时
  } else {
    // 年度模式：显示所有年份的统计
    // 年度模式：显示所有年份的统计
    const yearlyData = {};
    const filteredRecords = records.filter(r => {
      if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
      const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
      return selectedYears.has(year);
    });

    filteredRecords.forEach(record => {
      const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
      if (!yearlyData[year]) {
        yearlyData[year] = {
          trips: 0,
          distance: 0,
          cost: 0,
          duration: 0 // 以分钟为单位
        };
      }
      yearlyData[year].trips++;
      yearlyData[year].distance += record.distance || 0;
      yearlyData[year].cost += record.cost || 0;
      yearlyData[year].duration += parseDurationToMinutes(record.duration);
    });

    // 排序年份
    const years = Object.keys(yearlyData).sort((a, b) => parseInt(a) - parseInt(b));
    labels = years;
    trips = years.map(year => yearlyData[year].trips);
    distances = years.map(year => yearlyData[year].distance);
    costs = years.map(year => yearlyData[year].cost);
    durations = years.map(year => Math.round(yearlyData[year].duration / 60)); // 转换为小时
  }

  // 获取当前主题的文字颜色
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#e0e0e0' : '#212529';

  // 通用图表配置
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        bottom: 20 // 防止年份标签被截断
      }
    },
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false // 移除网格线
        },
        ticks: {
          color: textColor,
          padding: 5, // 减少标签与轴的间距
          maxRotation: 0, // 强制水平显示
          autoSkip: false // 尽可能显示所有年份
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          display: false // 移除网格线
        },
        ticks: {
          color: textColor
        }
      }
    }
  };

  // 销毁已存在的图表
  if (tripsChart) tripsChart.destroy();
  if (distanceChart) distanceChart.destroy();
  if (costChart) costChart.destroy();
  if (durationChart) durationChart.destroy();

  // 乘车次数图表
  const tripsCtx = document.getElementById('tripsChart').getContext('2d');
  tripsChart = new Chart(tripsCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: trips,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: commonOptions
  });

  // 里程图表
  const distanceCtx = document.getElementById('distanceChart').getContext('2d');
  distanceChart = new Chart(distanceCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: distances,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: commonOptions
  });

  // 花费图表
  const costCtx = document.getElementById('costChart').getContext('2d');
  costChart = new Chart(costCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: costs,
        backgroundColor: 'rgba(255, 206, 86, 0.6)',
        borderColor: 'rgba(255, 206, 86, 1)',
        borderWidth: 1
      }]
    },
    options: commonOptions
  });

  // 时长图表
  const durationCtx = document.getElementById('durationChart').getContext('2d');
  durationChart = new Chart(durationCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: durations,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: commonOptions
  });
}

// Create bureau statistics chart
function createBureauChart(selectedYear = null) {
  if (records.length === 0) {
    if (bureauChart) bureauChart.destroy();
    return;
  }

  // Update chart title based on entity type
  const cfg = getEntityConfig();
  const titleElement = document.getElementById('bureauChartTitle');
  if (titleElement) {
    titleElement.textContent = currentEntity === 'plane' ? '航空公司统计' : '铁路局统计';
  }

  // Filter records by year if selectedYear is provided
  const filteredRecords = selectedYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === selectedYear)
    : records.filter(r => {
      if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
      const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
      return selectedYears.has(year);
    });

  // Aggregate by appropriate field based on entity type
  // For trains: bureau field = railway bureau (铁路局)
  // For planes: trainType field = airline (航空公司), bureau field = aircraft type (机型)
  const fieldName = currentEntity === 'plane' ? 'trainType' : 'bureau';
  const bureauData = {};
  filteredRecords.forEach(record => {
    const value = record[fieldName] || '未知';
    if (!bureauData[value]) {
      bureauData[value] = 0;
    }
    bureauData[value]++;
  });

  // Sort by count descending
  const sortedBureaus = Object.entries(bureauData)
    .sort((a, b) => b[1] - a[1]);

  const labels = sortedBureaus.map(([bureau]) => bureau);
  const data = sortedBureaus.map(([, count]) => count);

  // Get theme color
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#e0e0e0' : '#212529';

  // Create color array - highlight 'unknown' with different color
  const backgroundColors = labels.map(label =>
    label === '未知' ? 'rgba(220, 53, 69, 0.6)' : 'rgba(153, 102, 255, 0.6)'
  );
  const borderColors = labels.map(label =>
    label === '未知' ? 'rgba(220, 53, 69, 1)' : 'rgba(153, 102, 255, 1)'
  );

  // Destroy existing chart
  if (bureauChart) bureauChart.destroy();

  // Create chart
  const bureauCtx = document.getElementById('bureauChart').getContext('2d');
  bureauChart = new Chart(bureauCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 20
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            padding: 5,
            maxRotation: 45,
            minRotation: 0,
            autoSkip: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            stepSize: 1
          }
        }
      }
    }
  });
}

// Create type statistics chart (train type for trains, aircraft type for planes)
function createTypeChart(selectedYear = null) {
  if (records.length === 0) {
    if (typeChart) typeChart.destroy();
    return;
  }

  // Update chart title based on entity type
  const titleElement = document.getElementById('typeChartTitle');
  if (titleElement) {
    titleElement.textContent = currentEntity === 'plane' ? '机型统计' : '车型统计';
  }

  // Filter records by year if selectedYear is provided
  const filteredRecords = selectedYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === selectedYear)
    : records.filter(r => {
      if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
      const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
      return selectedYears.has(year);
    });

  // Aggregate by appropriate field based on entity type
  // For trains: trainType field = train type (车型号)
  // For planes: bureau field = aircraft type (机型)
  const fieldName = currentEntity === 'plane' ? 'bureau' : 'trainType';
  const typeData = {};
  filteredRecords.forEach(record => {
    const value = record[fieldName] || '未知';
    if (!typeData[value]) {
      typeData[value] = 0;
    }
    typeData[value]++;
  });

  // Sort by count descending
  const sortedTypes = Object.entries(typeData)
    .sort((a, b) => b[1] - a[1]);

  const labels = sortedTypes.map(([type]) => type);
  const data = sortedTypes.map(([, count]) => count);

  // Get theme color
  const isDark = document.body.classList.contains('dark');
  const textColor = isDark ? '#e0e0e0' : '#212529';

  // Create color array - highlight 'unknown' with different color
  const backgroundColors = labels.map(label =>
    label === '未知' ? 'rgba(220, 53, 69, 0.6)' : 'rgba(255, 159, 64, 0.6)'
  );
  const borderColors = labels.map(label =>
    label === '未知' ? 'rgba(220, 53, 69, 1)' : 'rgba(255, 159, 64, 1)'
  );

  // Destroy existing chart
  if (typeChart) typeChart.destroy();

  // Create chart
  const typeCtx = document.getElementById('typeChart').getContext('2d');
  typeChart = new Chart(typeCtx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        borderColor: borderColors,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: {
          bottom: 20
        }
      },
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            padding: 5,
            maxRotation: 45,
            minRotation: 0,
            autoSkip: false
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            display: false
          },
          ticks: {
            color: textColor,
            stepSize: 1
          }
        }
      }
    }
  });
}

// 更新主题颜色时重新创建图表
function updateChartsTheme() {
  if (tripsChart || distanceChart || costChart || durationChart || bureauChart || typeChart) {
    // 延迟执行以确保CSS变量已更新
    setTimeout(() => {
      createYearlyCharts();
      createBureauChart();
      createTypeChart();
    }, 100);
  }
}

// 更新所有总结面板
function updateSummaryPanels() {
  updateAllTimeSummary();
  updateYearSelect();
  const selectedYear = yearSelect.value;
  if (selectedYear) {
    updateYearlySummary(selectedYear);
  }

  // 更新图表
  createYearlyCharts();
  createBureauChart();
  createTypeChart();
}

console.log('[Charts Module] ✅ 加载完成');
