// --- Global Variables & Constants ---
// API 配置已在 config.js 中定义，通过 window.API_CONFIG 访问
// 包括：高德地图、Google Maps、Gemini API 等配置
// 当前业务实体：train | plane
let currentEntity = localStorage.getItem('entity') || 'train';
const getStorageKey = () => currentEntity === 'plane' ? 'planeRecords' : 'trainRecords';
const GEOCODE_CACHE_KEY = 'geocodeCache'; // 新增：地理编码缓存键
const LIGHT_MAP_STYLE = API_CONFIG.amap.styles.light;
const DARK_MAP_STYLE = API_CONFIG.amap.styles.dark;
let records = [];
let insertionTarget = null;
let currentMode = 'add'; // 'add' | 'modify' | 'insert'
const counts = {}; // For offsetting duplicate paths
let map; // 当前地图实例
let currentMapType = 'amap'; // 'amap' | 'google' | 'leaflet'
let googleMap; // 谷歌地图实例
let amapInstance; // 高德地图实例
let leafletMap; // Leaflet 地图实例
let googleMapsLoaded = false; // 谷歌地图API加载状态
let selectedYears = new Set(); // 选中的年份集合
let isUserDeselectedAll = false; // 用户是否主动执行了"全不选"

// 新增：地理编码缓存
let geocodeCache = {};

// 表格列索引常量，避免魔法数字
const COL = {
  seq: 0,
  date: 1,
  time: 2,
  duration: 3,
  trainNo: 4,
  startStation: 5,
  startCity: 6,
  endStation: 7,
  endCity: 8,
  seatClass: 9,
  trainType: 10,
  bureau: 11,
  cost: 12,
  distance: 13,
  rmbPerKm: 14,
  speed: 15,
  notes: 16,
  actions: 17
};

// 地点标记功能已移除

// --- UI Elements ---
const themeToggle = document.getElementById('themeToggle');
const mapSelect = document.getElementById('mapSelect');
const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
const modeIndicator = document.getElementById('modeIndicator');
const addBtn = document.getElementById('addRecordBtn');
const tbody = document.querySelector('#historyTable tbody');
const modeTrainBtn = document.getElementById('modeTrainBtn');
const modePlaneBtn = document.getElementById('modePlaneBtn');
const sectionTitle = document.getElementById('sectionTitle');
// Form inputs
const seqInput = document.getElementById('seq');
const costInput = document.getElementById('cost');
const distanceInput = document.getElementById('distance');
const pricePerKmInput = document.getElementById('pricePerKm');
const endStationInput = document.getElementById('endStation');

const yearLegend = document.getElementById('yearLegend');
const legendContent = document.getElementById('legendContent');
const startCityInput = document.getElementById('startCity');
const endCityInput = document.getElementById('endCity');
const yearSelect = document.getElementById('yearSelect');
// 动态标签元素
const labelTrainNo = document.getElementById('label-trainNo');
const labelStartStation = document.getElementById('label-startStation');
const labelStartCity = document.getElementById('label-startCity');
const labelEndStation = document.getElementById('label-endStation');
const labelEndCity = document.getElementById('label-endCity');
const labelSeatClass = document.getElementById('label-seatClass');
const labelTrainType = document.getElementById('label-trainType');
const labelBureau = document.getElementById('label-bureau');

// 新增统计元素
const routeList = document.getElementById('routeList');
const cityList = document.getElementById('cityList');

// 新增导入导出元素
const importExcelBtn = document.getElementById('importExcelBtn');
const importExcelFile = document.getElementById('importExcelFile');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const backupBtn = document.getElementById('backupBtn');
const restoreBtn = document.getElementById('restoreBtn');
const restoreFile = document.getElementById('restoreFile');
const featuresHelpBtn = document.getElementById('featuresHelpBtn');
const featuresHelpOverlay = document.getElementById('featuresHelpOverlay');
const featuresHelpClose = document.getElementById('featuresHelpClose');

// Cloud Sync Elements
const cloudSettingsBtn = document.getElementById('cloudSettingsBtn');
const cloudUploadBtn = document.getElementById('cloudUploadBtn');
const cloudDownloadBtn = document.getElementById('cloudDownloadBtn');
const cloudSettingsModalOverlay = document.getElementById('cloudSettingsModalOverlay');
const cloudApiKeyInput = document.getElementById('cloudApiKey');
const cloudBinIdInput = document.getElementById('cloudBinId');
const cloudSettingsSaveBtn = document.getElementById('cloudSettingsSaveBtn');
const cloudSettingsCancelBtn = document.getElementById('cloudSettingsCancelBtn');

// Gemini Q&A Elements
const askGeminiBtn = document.getElementById('askGeminiBtn');
const geminiQAModalOverlay = document.getElementById('geminiQAModalOverlay');
const geminiQACloseBtn = document.getElementById('geminiQACloseBtn');
const geminiQAInput = document.getElementById('geminiQAInput');
const geminiQASendBtn = document.getElementById('geminiQASendBtn');
const geminiQAChatHistory = document.getElementById('geminiQAChatHistory');

// 图表实例
let tripsChart, distanceChart, costChart, durationChart, bureauChart, typeChart;

// Sorting State
let sortState = {
  field: null,
  order: 'asc' // 'asc' | 'desc'
};

// --- Functions ---

function getEntityConfig(entity = currentEntity) {
  if (entity === 'plane') {
    return {
      title: '机票记录',
      labels: {
        trainNo: '航班号',
        startStation: '出发机场',
        startCity: '出发城市',
        endStation: '到达机场',
        endCity: '到达城市',
        seatClass: '舱位',
        trainType: '航空公司',
        bureau: '机型'
      },
      th: {
        trainNo: '航班号', startStation: '出发机场', startCity: '出发城市', endStation: '到达机场', endCity: '到达城市', seatClass: '舱位', trainType: '航空公司', bureau: '机型'
      },
      placeSuffixZh: '机场',
      placeSuffixEn: 'airport',
      exportPrefix: '机票记录',
      backupPrefix: '机票记录备份'
    };
  }
  return {
    title: '火车票记录',
    labels: {
      trainNo: '车次',
      startStation: '起点站',
      startCity: '起点城市',
      endStation: '终点站',
      endCity: '终点城市',
      seatClass: '座席',
      trainType: '车型号',
      bureau: '铁路局'
    },
    th: {
      trainNo: '车次', startStation: '起点站', startCity: '起点城市', endStation: '终点站', endCity: '终点城市', seatClass: '座席', trainType: '车型号', bureau: '铁路局'
    },
    placeSuffixZh: '站',
    placeSuffixEn: 'railway station',
    exportPrefix: '火车票记录',
    backupPrefix: '火车票记录备份'
  };
}

function applyEntityUI(entity = currentEntity) {
  const cfg = getEntityConfig(entity);
  // 顶部按钮高亮
  modeTrainBtn.classList.toggle('active', entity === 'train');
  modePlaneBtn.classList.toggle('active', entity === 'plane');
  // 标题
  sectionTitle.textContent = cfg.title;
  document.title = `${cfg.title}与地图示例（含暗色模式）`;
  // 表单标签（行内编辑模式下可能不存在这些标签）
  if (labelTrainNo) labelTrainNo.textContent = cfg.labels.trainNo;
  if (labelStartStation) labelStartStation.textContent = cfg.labels.startStation;
  if (labelStartCity) labelStartCity.textContent = cfg.labels.startCity;
  if (labelEndStation) labelEndStation.textContent = cfg.labels.endStation;
  if (labelEndCity) labelEndCity.textContent = cfg.labels.endCity;
  if (labelSeatClass) labelSeatClass.textContent = cfg.labels.seatClass;
  if (labelTrainType) labelTrainType.textContent = cfg.labels.trainType;
  if (labelBureau) labelBureau.textContent = cfg.labels.bureau;
  // 表头
  document.getElementById('th-trainNo').textContent = cfg.th.trainNo;
  document.getElementById('th-startStation').textContent = cfg.th.startStation;
  document.getElementById('th-startCity').textContent = cfg.th.startCity;
  document.getElementById('th-endStation').textContent = cfg.th.endStation;
  document.getElementById('th-endCity').textContent = cfg.th.endCity;
  document.getElementById('th-seatClass').textContent = cfg.th.seatClass;
  document.getElementById('th-trainType').textContent = cfg.th.trainType;
  document.getElementById('th-bureau').textContent = cfg.th.bureau;
}

// 检查谷歌地图API加载状态
function checkGoogleMapsAPI() {
  if (window.google && window.google.maps) {
    googleMapsLoaded = true;
    console.log('✅ 谷歌地图API已加载');
    // 更新按钮状态，如果当前是高德地图，启用切换功能
    if (currentMapType === 'amap' && mapSelect) {
      mapSelect.disabled = false;
      mapSelect.style.opacity = '1';
    }
  } else {
    console.log('⏳ 等待谷歌地图API加载...');
    // 如果API未加载，禁用切换到谷歌地图的功能
    if (currentMapType === 'amap' && mapSelect) {
      // 可以在这里做一些提示，例如暂时禁用 Google 选项
      // mapSelect.querySelector('option[value="google"]').disabled = true;
    }
    setTimeout(checkGoogleMapsAPI, 1000);
  }
}

// 在页面加载时开始检查
checkGoogleMapsAPI();

// 初始化谷歌地图
function initGoogleMap() {
  console.log('尝试初始化谷歌地图...');

  if (!window.google || !window.google.maps) {
    console.error('谷歌地图API未加载完成，请检查网络连接和API密钥');
    alert('谷歌地图API未加载完成，请检查网络连接和API密钥');
    return null;
  }

  console.log('谷歌地图API已加载，正在创建地图实例...');

  const isDarkMode = document.body.classList.contains('dark');
  const mapOptions = API_CONFIG.getGoogleMapOptions(isDarkMode);

  try {
    const googleMapInstance = new google.maps.Map(document.getElementById('mapContainer'), mapOptions);
    console.log('谷歌地图创建成功');
    return googleMapInstance;
  } catch (error) {
    console.error('创建谷歌地图失败:', error);
    alert('创建谷歌地图失败: ' + error.message);
    return null;
  }
}

// 初始化高德地图
function initAmapMap() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  return new AMap.Map('mapContainer', {
    center: [106.712, 34.205],
    zoom: 5,
    mapStyle: savedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
    mapStyle: savedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
    scrollWheel: false, // 默认禁止缩放，需按 Command/Alt 键开启
  });
}

// 初始化 Leaflet 地图 (OSM)
function initLeafletMap() {
  console.log('初始化 Leaflet 地图...');
  // 移除旧容器内容 (如果需要)
  const container = document.getElementById('mapContainer');
  // 注意：Leaflet要求容器非空但我们通常是复用mapContainer
  // 并且Leaflet会自动处理

  // 需要手动销毁之前的实例如果存在 (虽switchMapType已清理)
  if (leafletMap) {
    leafletMap.remove();
    leafletMap = null;
  }

  // 默认中心：西安
  const map = L.map('mapContainer', {
    center: [34.205, 106.712],
    zoom: 5,
    scrollWheelZoom: false // 默认禁止滚轮缩放
  });

  // 使用 CartoDB Positron (简舒) 切片，界面更干净，减少边界线干扰
  // 浅色模式: CartoDB Positron
  // 深色模式在 updateMapTheme 中通过 CSS filter 处理，或者也可以切换到 CartoDB Dark Matter

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  return map;
}

// 切换布局后刷新地图尺寸
function refreshMapAfterLayoutChange() {
  try {
    let center = null, zoom = null;
    if (currentMapType === 'amap' && amapInstance) {
      const c = amapInstance.getCenter();
      center = { lat: c.lat, lng: c.lng };
      zoom = amapInstance.getZoom();
      amapInstance.resize && amapInstance.resize();
      if (center) amapInstance.setCenter([center.lng, center.lat]);
      if (zoom) amapInstance.setZoom(zoom);
    } else if (currentMapType === 'google' && googleMap) {
      const c = googleMap.getCenter();
      center = c ? { lat: c.lat(), lng: c.lng() } : null;
      zoom = googleMap.getZoom();
      if (google && google.maps) {
        google.maps.event.trigger(googleMap, 'resize');
      }
      if (center) googleMap.setCenter(center);
      if (zoom) googleMap.setZoom(zoom);
    }
  } catch (e) { console.warn('刷新地图尺寸失败:', e); }
}

// 切换地图类型
function switchMapType(targetType) {
  console.log(`开始切换地图: 当前 ${currentMapType}`);

  const newMapType = targetType || 'amap';
  console.log(`目标地图类型: ${newMapType}`);

  // 清除当前地图的所有覆盖物
  console.log('清除当前地图覆盖物...');
  clearAllPaths();

  // 保存当前地图的中心点和缩放级别
  let center, zoom;
  try {
    if (currentMapType === 'amap' && amapInstance) {
      const amapCenter = amapInstance.getCenter();
      center = { lat: amapCenter.lat, lng: amapCenter.lng };
      zoom = amapInstance.getZoom();
      console.log(`保存高德地图状态: 中心点 [${center.lat}, ${center.lng}], 缩放 ${zoom}`);
    } else if (currentMapType === 'google' && googleMap) {
      const googleCenter = googleMap.getCenter();
      center = { lat: googleCenter.lat(), lng: googleCenter.lng() };
      zoom = googleMap.getZoom();
      console.log(`保存谷歌地图状态: 中心点 [${center.lat}, ${center.lng}], 缩放 ${zoom}`);
    } else if (currentMapType === 'leaflet' && leafletMap) {
      const lCenter = leafletMap.getCenter();
      center = { lat: lCenter.lat, lng: lCenter.lng };
      zoom = leafletMap.getZoom();
      console.log(`保存Leaflet地图状态: 中心点 [${center.lat}, ${center.lng}], 缩放 ${zoom}`);
    }
  } catch (error) {
    console.warn('保存地图状态失败:', error);
    center = { lat: 34.205, lng: 106.712 };
    zoom = 5;
  }

  // 销毁当前地图
  try {
    if (currentMapType === 'amap' && amapInstance) {
      console.log('销毁高德地图实例...');
      amapInstance.destroy();
      amapInstance = null;
    }
    // 谷歌地图不需要显式销毁，只需要清除地图容器
    if (currentMapType === 'google') {
      console.log('清除谷歌地图...');
      // 只清空地图容器，保留按钮和图例
      document.getElementById('mapContainer').innerHTML = '';
    }
    if (currentMapType === 'leaflet' && leafletMap) {
      console.log('销毁Leaflet地图...');
      // 必须清除 CSS Filter，否则会遗留给下一个地图（导致高德变灰）
      try { leafletMap.getContainer().style.filter = 'none'; } catch (e) { }
      leafletMap.remove();
      leafletMap = null;
      document.getElementById('mapContainer').innerHTML = ''; // 清理额外的 DOM 元素
    }
  } catch (error) {
    console.warn('销毁地图失败:', error);
  }

  // 切换到新地图
  currentMapType = newMapType;
  console.log(`切换到新地图类型: ${currentMapType}`);

  if (newMapType === 'google') {
    console.log('初始化谷歌地图...');
    googleMap = initGoogleMap();
    if (googleMap) {
      if (center) {
        googleMap.setCenter(center);
        googleMap.setZoom(zoom || 5);
      }
      map = googleMap;
      if (center) {
        googleMap.setCenter(center);
        googleMap.setZoom(zoom || 5);
      }
      map = googleMap;
      // mapToggle text update removed
      console.log('谷歌地图初始化成功');
    } else {
      console.error('谷歌地图初始化失败，尝试切换到 OSM');
      // 失败则尝试 OSM
      switchMapType('leaflet');
      if (mapSelect) mapSelect.value = 'leaflet';
    }
  } else if (newMapType === 'leaflet') {
    console.log('初始化 Leaflet 地图...');
    try {
      leafletMap = initLeafletMap();
      if (leafletMap && center) {
        leafletMap.setView([center.lat, center.lng], zoom || 5);
      }
      map = leafletMap;
      // mapToggle text update removed
      console.log('Leaflet 地图初始化成功');
      // 立即应用主题（修复：首次切换时若是暗色模式，需立即应用 Filter）
      updateMapTheme();
    } catch (e) {
      console.error('Leaflet 地图初始化失败:', e);
      // 回退到高德
      currentMapType = 'amap';
      amapInstance = initAmapMap();
      map = amapInstance;
      // mapToggle text update removed
      if (mapSelect) mapSelect.value = 'amap';
    }
  } else {
    console.log('初始化高德地图...');
    amapInstance = initAmapMap();
    if (amapInstance && center) {
      amapInstance.setCenter([center.lng, center.lat]);
      amapInstance.setZoom(zoom || 5);
    }
    map = amapInstance;
    // mapToggle text update removed
    console.log('高德地图初始化成功');
  }

  // 保存地图类型到localStorage
  localStorage.setItem('currentMapType', currentMapType);
  console.log(`地图类型已保存: ${currentMapType}`);

  // 重新绘制所有路径
  console.log('准备重新绘制路径...');
  setTimeout(() => {
    console.log('开始重新绘制路径...');
    redrawAllPaths();
  }, 1000); // 增加等待时间确保地图完全初始化
}

// 清除所有路径
function clearAllPaths() {
  Array.from(tbody.children).forEach(tr => {
    if (tr._overlays) {
      tr._overlays.forEach(overlay => {
        if (currentMapType === 'amap') {
          if (overlay.setMap) overlay.setMap(null);
          if (amapInstance && amapInstance.remove) {
            try { amapInstance.remove(overlay); } catch (e) { }
          } else if (overlay.hide) {
            overlay.hide();
          }
        } else if (currentMapType === 'google') {
          if (overlay.setMap) overlay.setMap(null);
        } else if (currentMapType === 'leaflet') {
          // Leaflet clean up
          if (overlay.remove) overlay.remove();
          if (leafletMap && leafletMap.removeLayer) leafletMap.removeLayer(overlay);
        }
      });
      tr._overlays = [];
    }
  });
  // 清空计数器
  Object.keys(counts).forEach(key => delete counts[key]);
}

// Update map theme based on body class
function updateMapTheme() {
  const isDark = document.body.classList.contains('dark');
  if (currentMapType === 'amap' && amapInstance) {
    amapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE);
  } else if (currentMapType === 'google' && googleMap) {
    // 重新初始化Google Maps以应用主题
    const currentCenter = googleMap.getCenter();
    const currentZoom = googleMap.getZoom();

    // 清除当前地图
    clearAllPaths();

    // 使用 API_CONFIG 获取地图选项
    const isDarkMode = document.body.classList.contains('dark');
    const mapOptions = API_CONFIG.getGoogleMapOptions(isDarkMode);
    mapOptions.zoom = currentZoom;
    mapOptions.center = currentCenter;

    try {
      googleMap = new google.maps.Map(document.getElementById('mapContainer'), mapOptions);
      map = googleMap;
      console.log('Google Maps主题已更新');

      // 重新绘制所有路径
      setTimeout(() => {
        redrawAllPaths();
      }, 500);
    } catch (error) {
      console.error('更新Google Maps主题失败:', error);
    }
  } else if (currentMapType === 'leaflet' && leafletMap) {
    // Leaflet 简易暗黑模式：给容器加 CSS Filter
    const container = leafletMap.getContainer();
    if (isDark) {
      container.style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)';
    } else {
      container.style.filter = 'none';
    }
  }
  // Handle Replay Map
  if (replayMapInstance) {
    if (currentMapType === 'amap') {
      try { replayMapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE); } catch (e) { }
    } else if (currentMapType === 'google') {
      try {
        const styles = API_CONFIG.getGoogleMapOptions(isDark).styles;
        replayMapInstance.setOptions({ styles: styles || null });
      } catch (e) { console.warn('Update replay map theme failed(google)', e); }
    }
  }
  // 更新图表主题
  updateChartsTheme();
}

// Calculate RMB/km
function updatePricePerKm() {
  if (!costInput || !distanceInput || !pricePerKmInput) return;
  const c = parseFloat(costInput.value) || 0;
  const d = parseFloat(distanceInput.value) || 0;
  pricePerKmInput.value = d > 0 ? (c / d).toFixed(4) : '';
}

// Save records// 保存记录到 localStorage
function saveRecords() {
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(records));
  } catch (error) {
    console.error('保存记录失败:', error);
    alert('保存失败！可能是存储空间不足 (QuotaExceededError)。建议清理旧数据或使用云端同步。');
  }
}

// ===================== Sorting Functions =====================

function sortRecords(field) {
  // Toggle sort order if same field
  if (sortState.field === field) {
    sortState.order = sortState.order === 'asc' ? 'desc' : 'asc';
  } else {
    sortState.field = field;
    sortState.order = 'asc';
  }

  // Update visual indicators
  document.querySelectorAll('.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
  });
  const activeTh = document.querySelector(`.sortable[data-field="${field}"]`);
  if (activeTh) {
    activeTh.classList.add(`sort-${sortState.order}`);
  }

  // Sort records array
  records.sort((a, b) => {
    let aVal, bVal;

    // Helper to calculate derived values
    const getVal = (rec, f) => {
      if (f === 'rpk') {
        return rec.distance > 0 ? (rec.cost / rec.distance) : 0;
      }
      if (f === 'speed') {
        const mins = parseDurationToMinutes(rec.duration);
        return (rec.distance > 0 && mins > 0) ? (rec.distance / (mins / 60)) : 0;
      }
      if (f === 'duration') {
        return parseDurationToMinutes(rec.duration);
      }
      return rec[f];
    };

    aVal = getVal(a, field);
    bVal = getVal(b, field);

    // Handle numeric comparisons
    if (['cost', 'distance', 'rpk', 'speed', 'duration'].includes(field)) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else {
      // String comparison for date, time
      aVal = String(aVal || '');
      bVal = String(bVal || '');
    }

    if (aVal < bVal) return sortState.order === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortState.order === 'asc' ? 1 : -1;
    return 0;
  });

  // Re-render table
  rerenderTable();
}

// ===================== Rendering Functions =====================

function rerenderTable(filterYear = null) {
  // Clear all map overlays first to avoid orphaned paths
  if (filterYear) {
    Array.from(tbody.children).forEach(tr => {
      if (tr._overlays) {
        tr._overlays.forEach(o => {
          try {
            if (currentMapType === 'amap') {
              if (o.setMap) o.setMap(null);
              if (amapInstance && amapInstance.remove) {
                try { amapInstance.remove(o); } catch (e) { }
              }
            } else if (currentMapType === 'google') {
              if (o.setMap) o.setMap(null);
            } else if (currentMapType === 'leaflet') {
              if (o.remove) o.remove();
            }
          } catch { }
        });
        tr._overlays = [];
      }
    });
  }

  // Clear tbody
  tbody.innerHTML = '';

  // Filter records if year is provided
  const displayRecords = filterYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === filterYear)
    : records;

  // Render filtered records
  displayRecords.forEach(rec => {
    const rpk = rec.distance > 0 ? (rec.cost / rec.distance).toFixed(4) : '';

    // Calculate Speed (km/h)
    let speedStr = '';
    const durationMins = parseDurationToMinutes(rec.duration);
    if (rec.distance > 0 && durationMins > 0) {
      const hours = durationMins / 60;
      speedStr = (rec.distance / hours).toFixed(1);
    }

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td></td> <!-- Seq # updated later -->
      <td>${rec.date || ''}</td>
      <td>${rec.time || ''}</td>
      <td>${rec.duration || ''}</td>
      <td>${rec.trainNo || ''}</td>
      <td>${rec.startStation || ''}</td>
      <td>${rec.startCity || ''}</td>
      <td>${rec.endStation || ''}</td>
      <td>${rec.endCity || ''}</td>
      <td>${rec.seatClass || ''}</td>
      <td>${rec.trainType || ''}</td>
      <td>${rec.bureau || ''}</td>
      <td>${(rec.cost || 0).toFixed(2)}</td>
      <td>${rec.distance || 0}</td>
      <td>${rpk}</td>
      <td>${speedStr}</td>
      <td>${rec.notes || ''}</td>
      <td>
        <div class="action-menu">
          <button class="action-menu-btn">⋮</button>
          <div class="action-menu-dropdown">
            <button class="modify">✏️ 修改</button>
            <button class="insert">➕ 插入</button>
            <button class="redraw">🔄 重新画线</button>
            <button class="delete">🗑️ 删除</button>
          </div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    attachRowEvents(tr);

    // Add dropdown toggle functionality
    const menuBtn = tr.querySelector('.action-menu-btn');
    const menu = tr.querySelector('.action-menu');
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other menus
      document.querySelectorAll('.action-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });

    // Draw path for this record
    drawPath(tr, rec);

    // Attach record reference for click-to-scroll
    tr._record = rec;
  });

  // Update sequence numbers
  updateSequenceNumbers();

  // Update stats and map (don't trigger full update to avoid recursion)
  updateYearLegend();
}

// 高亮并滚动到指定记录
function highlightRecord(record) {
  if (!record) return;

  // 查找对应的行
  const rows = Array.from(tbody.children);
  let targetRow = rows.find(tr => tr._record === record);

  // 如果引用匹配失败，尝试值匹配 (Date + Time + TrainNo)
  if (!targetRow) {
    targetRow = rows.find(tr => {
      const r = tr._record;
      return r && r.date === record.date && r.time === record.time && r.trainNo === record.trainNo;
    });
  }

  if (targetRow) {
    targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetRow.classList.add('highlight-row');
    setTimeout(() => targetRow.classList.remove('highlight-row'), 5000);
  } else {
    // 可能是因为当前表格被过滤了，或者记录确实不存在
    const tabName = document.querySelector('.summary-tab.active').dataset.tab;
    if (tabName === 'yearly' && record.date && record.date.substring(0, 4) !== yearSelect.value) {
      alert(`无法定位：该记录不在当前展示的年份 (${yearSelect.value}) 中。\n请切换到"历史总结"查看。`);
    } else {
      console.warn('Unable to highlight record:', record);
    }
  }
}


// 通用二次确认执行封装
function confirmRun(message, action) {
  try {
    if (confirm(message)) {
      action && action();
    }
  } catch (e) {
    console.warn('确认执行失败', e);
  }
}

// 计算总时长（将时长字符串转换为分钟数）
function parseDurationToMinutes(duration) {
  if (!duration) return 0;
  const match = duration.match(/(\d{1,2}):(\d{1,2})/);
  if (match) {
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    return hours * 60 + minutes;
  }
  return 0;
}

// 将分钟数转换为时长字符串
function formatMinutesToDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}小时${mins}分钟`;
}

// --- 辅助：时长选择器 ---
function buildDurationSelects(initialHHMM = '') {
  // initialHHMM: 'HH:MM' 或空
  let initH = 0, initM = 0;
  const m = (initialHHMM || '').match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    initH = Math.min(80, Math.max(0, parseInt(m[1]) || 0));
    initM = Math.min(59, Math.max(0, parseInt(m[2]) || 0));
  }
  const hourOptions = Array.from({ length: 81 }, (_, h) => `<option value="${h}" ${h === initH ? 'selected' : ''}>${String(h).padStart(2, '0')}</option>`).join('');
  const minuteOptions = Array.from({ length: 60 }, (_, mm) => `<option value="${mm}" ${mm === initM ? 'selected' : ''}>${String(mm).padStart(2, '0')}</option>`).join('');
  return `
        <span class="duration-editor" title="时长 (HH:MM)">
          <select class="inline-select dur-hour" aria-label="小时">${hourOptions}</select>
          :
          <select class="inline-select dur-min" aria-label="分钟">${minuteOptions}</select>
        </span>
      `;
}

function readDurationFromRowCell(td) {
  const hSel = td.querySelector('select.dur-hour');
  const mSel = td.querySelector('select.dur-min');
  if (hSel && mSel) {
    const h = String(parseInt(hSel.value) || 0).padStart(2, '0');
    const m = String(parseInt(mSel.value) || 0).padStart(2, '0');
    return `${h}:${m}`;
  }
  // 兼容旧的文本输入
  const inp = td.querySelector('input');
  return inp ? inp.value.trim() : td.innerText.trim();
}

// 更新历史总结
function updateAllTimeSummary() {
  const container = document.getElementById('allStatsGrid');

  if (records.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999;">暂无数据</div>';
    return;
  }

  // 统计数据
  const totalTrips = records.length;
  const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalDistance = records.reduce((sum, r) => sum + (r.distance || 0), 0);
  const totalMinutes = records.reduce((sum, r) => sum + parseDurationToMinutes(r.duration), 0);

  // 统计城市（仅统计终点城市作为到访城市）
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
  // 列1: 数量/杂项 (总行程, 到访城市, 绕地球圈数)
  // 列2: 里程 (总里程, 平均里程, 最远行程)
  // 列3: 时长 (总时长, 平均时长, 最长时长)
  // 列4: 花费 (总花费, 平均花费, 最贵行程)

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
        <div class="stat-card interactable-card" id="stat-all-longest-dist">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestTrip)}</div>
          <div class="stat-label">📏 最远行程 (${longestTrip.distance} km)</div>
        </div>
        <div class="stat-card interactable-card" id="stat-all-longest-time">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(longestDurationTrip)}</div>
          <div class="stat-label">⏳ 最长时长 (${longestDurationTrip.duration})</div>
        </div>
        <div class="stat-card interactable-card" id="stat-all-most-exp">
          <div class="stat-value" style="font-size:16px;">${fmtTrip(mostExpensive)}</div>
          <div class="stat-label">💰 最贵行程 (¥${mostExpensive.cost})</div>
        </div>
      `;

  // Bind click events
  document.getElementById('stat-all-longest-dist').onclick = () => highlightRecord(longestTrip);
  document.getElementById('stat-all-longest-time').onclick = () => highlightRecord(longestDurationTrip);
  document.getElementById('stat-all-most-exp').onclick = () => highlightRecord(mostExpensive);
}

// 更新年份选择器
function updateYearSelect() {
  const years = [...new Set(records.map(r => {
    if (r.date) {
      return r.date.substring(0, 4);
    }
    return null;
  }).filter(y => y))].sort((a, b) => parseInt(b) - parseInt(a));

  yearSelect.innerHTML = '<option value="">请选择年份</option>';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = `${year}年`;
    yearSelect.appendChild(option);
  });
}

// 更新年度总结
function updateYearlySummary(year) {
  const container = document.getElementById('yearlyStatsGrid');

  if (!year) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999;">请选择年份</div>';
    return;
  }

  const yearRecords = records.filter(r => r.date && r.date.substring(0, 4) === year);

  if (yearRecords.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #999;">该年份暂无数据</div>';
    return;
  }

  // 统计数据
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

  // 生成统计卡片 (4x3 布局) - 保持与 updateAllTimeSummary 完全一致
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

// 新增：从表格同步数据到records数组
function syncRecordsFromTable() {
  records = [];
  Array.from(tbody.children).forEach(tr => {
    const cells = tr.cells;
    const record = {
      date: cells[COL.date].innerText,
      time: cells[COL.time].innerText,
      duration: cells[COL.duration].innerText,
      trainNo: cells[COL.trainNo].innerText,
      startStation: cells[COL.startStation].innerText,
      startCity: cells[COL.startCity].innerText,
      endStation: cells[COL.endStation].innerText,
      endCity: cells[COL.endCity].innerText,
      seatClass: cells[COL.seatClass].innerText,
      trainType: cells[COL.trainType].innerText,
      bureau: cells[COL.bureau].innerText,
      cost: parseFloat(cells[COL.cost].innerText) || 0,
      distance: parseFloat(cells[COL.distance].innerText) || 0,
      notes: cells[COL.notes].innerText
    };
    records.push(record);
  });

  // 保存到localStorage
  saveRecords();

  // 更新总结面板与出行统计
  updateSummaryPanels();
  updateStats();
}

// Add a record to the table and draw it on the map
function addRecordToTable(recordData, insertAfterTr = null) {
  const tr = document.createElement('tr');
  const rpk = recordData.distance > 0 ? (recordData.cost / recordData.distance).toFixed(4) : '';
  tr.innerHTML = `
        <td></td> <!-- Seq # updated later -->
        <td>${recordData.date}</td>
        <td>${recordData.time}</td>
        <td>${recordData.duration}</td>
        <td>${recordData.trainNo}</td>
        <td>${recordData.startStation}</td>
        <td>${recordData.startCity}</td>
        <td>${recordData.endStation}</td>
        <td>${recordData.endCity}</td>
        <td>${recordData.seatClass}</td>
        <td>${recordData.trainType}</td>
        <td>${recordData.bureau}</td>
        <td>${recordData.cost.toFixed(2)}</div>
        <td>${recordData.distance}</td>
        <td>${rpk}</td>
        <td>${(() => {
      const durationMins = parseDurationToMinutes(recordData.duration);
      if (recordData.distance > 0 && durationMins > 0) {
        return (recordData.distance / (durationMins / 60)).toFixed(1);
      }
      return '';
    })()}</td>
        <td>${recordData.notes}</td>
        <td>
          <div class="action-menu">
            <button class="action-menu-btn">⋮</button>
            <div class="action-menu-dropdown">
              <button class="modify">✏️ 修改</button>
              <button class="insert">➕ 插入</button>
              <button class="redraw">🔄 重新画线</button>
              <button class="delete">🗑️ 删除</button>
            </div>
          </div>
        </td>
      `;

  // 修复插入逻辑
  if (insertAfterTr && insertAfterTr.parentNode) {
    // 插入到指定行的后面
    if (insertAfterTr.nextSibling) {
      tbody.insertBefore(tr, insertAfterTr.nextSibling);
    } else {
      tbody.appendChild(tr);
    }
  } else {
    // 默认添加到末尾
    tbody.appendChild(tr);
  }

  attachRowEvents(tr);

  // Add dropdown toggle functionality
  const menuBtn = tr.querySelector('.action-menu-btn');
  const menu = tr.querySelector('.action-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other menus
      document.querySelectorAll('.action-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });
  }

  // 实时绘制路径，无论地图是否完全加载
  drawPath(tr, recordData);

  // 更新图例和统计
  updateYearLegend();
  updateStats();

  return tr;
}


// 根据年份生成颜色的函数（提取为独立函数以便复用）
function getYearColor(year) {
  const colors = [
    '#FF0000', // 红色
    '#00FF00', // 绿色  
    '#0000FF', // 蓝色
    '#FFD700', // 金色
    '#FF69B4', // 粉色
    '#00FFFF', // 青色
    '#FF4500', // 橙红色
    '#9370DB', // 紫色
    '#32CD32', // 酸橙绿
    '#FF1493', // 深粉色
    '#00CED1', // 暗绿松石色
    '#FF6347', // 番茄色
    '#4169E1', // 皇家蓝
    '#DC143C', // 深红色
    '#228B22', // 森林绿
    '#B22222', // 火砖色
    '#4B0082', // 靛蓝
    '#DAA520', // 金杆色
    '#8A2BE2', // 蓝紫色
    '#FF8C00'  // 暗橙色
  ];

  const yearNum = parseInt(year) || new Date().getFullYear();
  const colorIndex = yearNum % colors.length;
  return colors[colorIndex];
}

// 更新年份图例 - 交互式图例
function updateYearLegend() {
  // 统计每年的记录数量和里程数
  const yearStats = {};
  records.forEach(record => {
    const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
    if (!yearStats[year]) {
      yearStats[year] = { count: 0, distance: 0 };
    }
    yearStats[year].count++;
    yearStats[year].distance += record.distance || 0;
  });

  // 清空图例内容
  legendContent.innerHTML = '';

  // 按年份排序
  const sortedYears = Object.keys(yearStats).sort((a, b) => parseInt(a) - parseInt(b));

  if (sortedYears.length === 0) {
    legendContent.innerHTML = '<div style="font-size: 10px; color: #999; text-align: center;">暂无数据</div>';
    return;
  }

  // 如果selectedYears为空且用户没有主动全不选，默认选中所有年份
  if (selectedYears.size === 0 && !isUserDeselectedAll) {
    sortedYears.forEach(year => selectedYears.add(year));
  }

  // 检测是否处于年度筛选模式（仅选中一个年份且在年度总结标签）
  const yearlyTab = document.querySelector('.summary-tab[data-tab="yearly"]');
  const isYearFilterMode = yearlyTab && yearlyTab.classList.contains('active') && selectedYears.size === 1;

  // 添加控制按钮
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'legend-controls';

  if (isYearFilterMode) {
    // 年度筛选模式：显示提示信息
    const infoDiv = document.createElement('div');
    infoDiv.style.cssText = 'font-size: 10px; color: var(--primary-color); padding: 4px 8px; background: rgba(var(--primary-color-rgb, 13, 110, 253), 0.1); border-radius: 3px; text-align: center; margin-bottom: 4px;';
    infoDiv.textContent = `📌 当前显示：${Array.from(selectedYears)[0]}年`;
    legendContent.appendChild(infoDiv);
  } else {
    // 正常模式：显示全选/全不选按钮
    const selectAllBtn = document.createElement('button');
    selectAllBtn.className = 'legend-select-all';
    selectAllBtn.textContent = '全选';
    selectAllBtn.onclick = () => {
      console.log('点击全选按钮');
      selectedYears.clear();
      isUserDeselectedAll = false; // 重置标志
      sortedYears.forEach(year => selectedYears.add(year));
      console.log('全选后selectedYears:', Array.from(selectedYears));
      updateYearLegend();
      updatePathVisibility();
    };

    const deselectAllBtn = document.createElement('button');
    deselectAllBtn.className = 'legend-select-all';
    deselectAllBtn.textContent = '全不选';
    deselectAllBtn.style.background = '#dc3545';
    deselectAllBtn.onclick = () => {
      console.log('点击全不选按钮');
      selectedYears.clear();
      isUserDeselectedAll = true; // 标记用户主动全不选
      console.log('全不选后selectedYears:', Array.from(selectedYears));

      // 先更新路径可见性，隐藏所有线条
      updatePathVisibility();
      // 再更新图例显示（这会重新生成DOM并正确设置复选框状态）
      updateYearLegend();
    };

    controlsDiv.appendChild(selectAllBtn);
    controlsDiv.appendChild(deselectAllBtn);
    legendContent.appendChild(controlsDiv);
  }

  // 生成图例项
  sortedYears.forEach(year => {
    const stats = yearStats[year];
    const color = getYearColor(year);
    const isSelected = selectedYears.has(year);

    const legendItem = document.createElement('div');
    legendItem.className = `legend-item ${isSelected ? '' : 'disabled'}`;

    // 在年度筛选模式下禁用复选框
    const disabledAttr = isYearFilterMode ? 'disabled' : '';
    const opacityStyle = isYearFilterMode && !isSelected ? 'opacity: 0.3;' : '';

    legendItem.innerHTML = `
                <input type="checkbox" class="legend-checkbox" ${isSelected ? 'checked' : ''} ${disabledAttr}
                       onchange="toggleYearVisibility('${year}')">
                <div class="legend-color" style="background-color: ${color}; ${opacityStyle}"></div>
                <div class="legend-text" style="${opacityStyle}">${year}年<br><span style="font-size: 9px; opacity: 0.8;">${stats.count}次 | ${stats.distance.toFixed(0)}km</span></div>
            `;

    // 整个项目可点击（但在年度筛选模式下禁用）
    if (!isYearFilterMode) {
      legendItem.onclick = (e) => {
        if (e.target.type !== 'checkbox') {
          e.preventDefault();
          const checkbox = legendItem.querySelector('.legend-checkbox');
          checkbox.checked = !checkbox.checked;
          toggleYearVisibility(year);
        }
      };
    } else {
      legendItem.style.cursor = 'default';
    }

    legendContent.appendChild(legendItem);
  });
}

// 更新路线热力图和地区统计
function updateStats() {
  updateRouteHeatmap();
  updateRegionStats();
}

// 更新路线热力图
function updateRouteHeatmap(filterYear = null) {
  const routeStats = {};

  // 根据年份筛选记录
  const filteredRecords = filterYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === filterYear)
    : records;

  filteredRecords.forEach(record => {
    const route = `${record.startCity || record.startStation} → ${record.endCity || record.endStation}`;
    if (!routeStats[route]) {
      routeStats[route] = { count: 0, distance: 0 };
    }
    routeStats[route].count++;
    routeStats[route].distance += record.distance || 0;
  });

  // 按次数排序
  const sortedRoutes = Object.entries(routeStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10); // 显示前10条热门路线

  routeList.innerHTML = '';
  if (sortedRoutes.length === 0) {
    routeList.innerHTML = '<div style="color: #999; text-align: center;">暂无数据</div>';
    return;
  }

  sortedRoutes.forEach(([route, stats], index) => {
    const intensity = Math.min(stats.count / sortedRoutes[0][1].count, 1);
    const color = `rgba(255, 99, 71, ${0.3 + intensity * 0.7})`;

    const routeItem = document.createElement('div');
    routeItem.style.cssText = `
                padding: 4px 6px; 
                margin: 2px 0; 
                background: ${color}; 
                border-radius: 3px; 
                border-left: 3px solid rgba(255, 99, 71, ${intensity});
                font-size: 10px;
            `;
    routeItem.innerHTML = `
                <div style="font-weight: bold;">${route}</div>
                <div style="opacity: 0.8;">${stats.count}次 | ${stats.distance.toFixed(0)}km</div>
            `;
    routeList.appendChild(routeItem);
  });
}

// 更新地区统计
function updateRegionStats(filterYear = null) {
  const cityStats = {};

  // 根据年份筛选记录
  const filteredRecords = filterYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === filterYear)
    : records;

  // 仅统计终点城市（到访城市）
  filteredRecords.forEach(record => {
    const endCity = record.endCity || record.endStation;
    if (!endCity) return;
    const key = endCity.trim();
    if (!key) return;
    if (!cityStats[key]) {
      cityStats[key] = { visits: 0, type: 'destination' };
    }
    cityStats[key].visits++;
  });

  // 按访问次数排序
  const sortedCities = Object.entries(cityStats)
    .sort((a, b) => b[1].visits - a[1].visits)
    .slice(0, 15); // 显示前15个城市

  cityList.innerHTML = '';
  if (sortedCities.length === 0) {
    cityList.innerHTML = '<div style="color: #999; text-align: center;">暂无数据</div>';
    return;
  }

  sortedCities.forEach(([city, stats]) => {
    const typeIcon = '🎯'; // 仅终点
    const intensity = Math.min(stats.visits / sortedCities[0][1].visits, 1);
    const color = `rgba(54, 162, 235, ${0.3 + intensity * 0.7})`;

    const cityItem = document.createElement('div');
    cityItem.style.cssText = `
                padding: 3px 6px; 
                margin: 2px 0; 
                background: ${color}; 
                border-radius: 3px;
                font-size: 10px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
    cityItem.innerHTML = `
                <span>${typeIcon} ${city}</span>
                <span style="font-weight: bold;">${stats.visits}次</span>
            `;
    cityList.appendChild(cityItem);
  });
}

// 切换年份显示状态 - 全局函数
window.toggleYearVisibility = function (year) {
  if (selectedYears.has(year)) {
    selectedYears.delete(year);
  } else {
    selectedYears.add(year);
    isUserDeselectedAll = false; // 如果用户选择了某个年份，重置全不选标志
  }
  updateYearLegend();
  updatePathVisibility();
};

// 更新路径可见性
function updatePathVisibility() {
  console.log(`更新路径可见性，选中年份: [${Array.from(selectedYears).join(', ')}]`);

  Array.from(tbody.children).forEach((tr, index) => {
    const record = records[index];
    if (!record) return;

    const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
    const shouldShow = selectedYears.has(year);

    // 更新覆盖物的可见性
    if (tr._overlays) {
      tr._overlays.forEach(overlay => {
        if (currentMapType === 'amap') {
          if (overlay.getPath && overlay.setOptions) {
            // 高德地图的线条
            overlay.setOptions({
              strokeOpacity: shouldShow ? 0.9 : 0,
              zIndex: shouldShow ? 100 : -1
            });
          } else if (overlay.setText || overlay.getText) {
            // 高德地图的年份标签
            if (shouldShow) {
              overlay.show();
            } else {
              overlay.hide();
            }
          }
        } else if (currentMapType === 'google') {
          if (overlay.getPath && overlay.setOptions) {
            // 谷歌地图的线条
            overlay.setOptions({
              strokeOpacity: shouldShow ? 0.9 : 0,
              zIndex: shouldShow ? 100 : -1
            });
          } else if (overlay.getIcon && overlay.setVisible) {
            // 谷歌地图的年份标签（Marker）
            overlay.setVisible(shouldShow);
          }
        } else if (currentMapType === 'leaflet') {
          // Leaflet: setStyle (path) or setOpacity (marker)
          if (overlay instanceof L.Polyline) {
            overlay.setStyle({
              opacity: shouldShow ? 0.9 : 0,
              interactive: shouldShow // 隐藏时不响应交互
            });
            // 如果不想让它挡住别的，还需要 bringToBack/Front
            if (shouldShow) overlay.bringToFront(); else overlay.bringToBack();
          } else if (overlay instanceof L.Marker) { // 我们的文字标签用Marker divIcon
            overlay.setOpacity(shouldShow ? 1 : 0);
          }
        }
      });
    }
  });

  console.log(`路径可见性更新完成`);
}

// 创建年度统计图表
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
    const yearlyData = {};
    records.forEach(record => {
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
    : records;

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
    : records;

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

// Save geocode results to localStorage
function saveGeocodeCache() {
  try {
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache));
  } catch (error) {
    console.error('保存地理编码缓存失败:', error);
  }
}

// Load geocode results from localStorage
function loadGeocodeCache() {
  try {
    const cached = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (cached) {
      geocodeCache = JSON.parse(cached);
      console.log(`已加载 ${Object.keys(geocodeCache).length} 个缓存的地理编码结果`);
    }
  } catch (error) {
    console.error('加载地理编码缓存失败:', error);
    geocodeCache = {};
  }
}

// Update sequence numbers in the table
function updateSequenceNumbers() {
  Array.from(tbody.children).forEach((tr, i) => {
    tr.cells[COL.seq].innerText = i + 1;
  });
}

// Set the current operation mode ('add', 'modify', 'insert')
function setMode(mode, targetTr = null) {
  currentMode = mode;
  insertionTarget = targetTr; // Used for 'insert' and 'modify' modes

  if (mode === 'modify') {
    modeIndicator.textContent = '当前操作：修改';
    addBtn.textContent = '保存修改';
  } else if (mode === 'insert') {
    modeIndicator.textContent = '当前操作：插入';
    addBtn.textContent = '在此行后插入';
  } else { // 'add' mode
    modeIndicator.textContent = '当前操作：添加';
    addBtn.textContent = '添加记录';
    insertionTarget = null;
  }
  updateSeqInput();
}

// Update the sequence input field based on the mode
function updateSeqInput() {
  if (!seqInput) return; // 行内编辑模式下无序号输入
  if (currentMode === 'insert' && insertionTarget) {
    const idx = Array.from(tbody.children).indexOf(insertionTarget);
    seqInput.value = idx + 2;
  } else if (currentMode === 'modify') {
    // seqInput is already populated
  } else { // 'add' mode
    seqInput.value = tbody.children.length + 1;
  }
}

// Clear the input form
function clearForm() {
  const ids = ['date', 'time', 'duration', 'trainNo', 'startStation', 'startCity', 'endStation', 'endCity', 'seatClass', 'trainType', 'bureau', 'cost', 'distance', 'notes'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (typeof updatePricePerKm === 'function') updatePricePerKm();
  updateSeqInput();
}

// 统一的改动后重绘流程：更新序号→同步数据→清除路径→重绘路径→刷新图例与统计
function afterChangeRerender() {
  try { updateSequenceNumbers(); } catch { }
  try { syncRecordsFromTable(); } catch { }
  try { clearAllPaths(); } catch { }
  try { redrawAllPaths(); } catch { }
  try { updateYearLegend && updateYearLegend(); } catch { }
  try { updateStats && updateStats(); } catch { }
}

// Attach event listeners to buttons in a table row（改为行内编辑模式）
function attachRowEvents(tr) {
  // Row Hover Interaction
  tr.addEventListener('mouseenter', () => {
    tr.classList.add('highlight-row');
    if (tr._overlays) {
      tr._overlays.forEach(o => {
        try {
          if (currentMapType === 'amap') {
            if (o.setOptions) o.setOptions({ strokeWeight: 5, zIndex: 100 });
          } else if (currentMapType === 'google') {
            if (o.setOptions) o.setOptions({ strokeWeight: 5, zIndex: 100 });
          } else if (currentMapType === 'leaflet') {
            if (o instanceof L.Polyline) {
              o.setStyle({ weight: 5 });
              o.bringToFront();
            }
          }
        } catch { }
      });
    }
  });
  tr.addEventListener('mouseleave', () => {
    tr.classList.remove('highlight-row');
    if (tr._overlays) {
      tr._overlays.forEach(o => {
        try {
          if (currentMapType === 'amap') {
            if (o.setOptions) o.setOptions({ strokeWeight: 2, zIndex: 50 });
          } else if (currentMapType === 'google') {
            if (o.setOptions) o.setOptions({ strokeWeight: 2, zIndex: 50 });
          } else if (currentMapType === 'leaflet') {
            if (o instanceof L.Polyline) {
              o.setStyle({ weight: 2 });
            }
          }
        } catch { }
      });
    }
  });

  const bindActions = () => {
    const delBtn = tr.querySelector('.delete');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('确认删除该记录及其线路？\n此操作不可撤销。')) return;
        // 移除本行覆盖物
        if (tr._overlays) {
          tr._overlays.forEach(o => {
            try {
              if (currentMapType === 'amap') {
                if (o.setMap) o.setMap(null);
                if (amapInstance && amapInstance.remove) amapInstance.remove(o);
              } else if (currentMapType === 'google') {
                if (o.setMap) o.setMap(null);
              } else if (currentMapType === 'leaflet') {
                if (o.remove) o.remove();
              }
            } catch { }
          });
          tr._overlays = [];
        }
        const idx = Array.from(tbody.children).indexOf(tr);
        tr.remove();
        if (idx > -1) {
          // 从 records 中移除对应数据
          records.splice(idx, 1);
          saveRecords();
        }
        // 更新序号/图例/统计（无需全量清除重绘）
        updateSequenceNumbers();
        try { updateYearLegend && updateYearLegend(); } catch { }
        try { updateStats && updateStats(); } catch { }
      }, { once: true });
    }

    const modBtn = tr.querySelector('.modify');
    if (modBtn) {
      modBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        enterInlineEdit(tr);
      }, { once: true });
    }

    const insBtn = tr.querySelector('.insert');
    if (insBtn) {
      insBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        insertInlineAfter(tr);
      }, { once: true });
    }

    const redrawBtn = tr.querySelector('.redraw');
    if (redrawBtn) {
      redrawBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = Array.from(tbody.children).indexOf(tr);
        if (idx === -1) return;
        const record = records[idx];
        if (!record || !record.startStation || !record.endStation) {
          alert('无法重绘：记录信息不完整');
          return;
        }

        // Clear path cache
        delete record.pathWGS;
        delete record.pathGCJ;
        delete record.pathIndex;
        delete record.startLon;
        delete record.startLat;
        delete record.endLon;
        delete record.endLat;

        // Remove existing overlays
        if (tr._overlays) {
          tr._overlays.forEach(o => {
            try {
              if (currentMapType === 'amap') {
                if (o.setMap) o.setMap(null);
                if (amapInstance && amapInstance.remove) amapInstance.remove(o);
              } else if (currentMapType === 'google') {
                if (o.setMap) o.setMap(null);
              } else if (currentMapType === 'leaflet') {
                if (o.remove) o.remove();
              }
            } catch { }
          });
          tr._overlays = [];
        }

        // Redraw the path
        try {
          await drawPath(tr, record);
          alert('线路已重新绘制');
        } catch (error) {
          alert('重新绘制失败: ' + error.message);
        }
      }, { once: true });
    }
  };
  bindActions();
}

// 将当前行切换为可编辑状态
function enterInlineEdit(tr) {
  const c = tr.cells;
  const original = {
    date: c[COL.date].innerText,
    time: c[COL.time].innerText,
    duration: c[COL.duration].innerText,
    trainNo: c[COL.trainNo].innerText,
    startStation: c[COL.startStation].innerText,
    startCity: c[COL.startCity].innerText,
    endStation: c[COL.endStation].innerText,
    endCity: c[COL.endCity].innerText,
    seatClass: c[COL.seatClass].innerText,
    trainType: c[COL.trainType].innerText,
    bureau: c[COL.bureau].innerText,
    cost: c[COL.cost].innerText,
    distance: c[COL.distance].innerText,
    pricePerKm: c[COL.rmbPerKm].innerText,
    speed: c[COL.speed].innerText,
    notes: c[COL.notes].innerText
  };
  tr._editOriginal = original;

  // 构造输入
  const cfg = getEntityConfig();
  c[COL.date].innerHTML = `<input class=\"inline-input\" type=\"date\" placeholder=\"日期\" title=\"日期\" value=\"${original.date || ''}\">`;
  c[COL.time].innerHTML = `<input class=\"inline-input\" type=\"time\" placeholder=\"时间\" title=\"时间\" value=\"${original.time || ''}\">`;
  c[COL.duration].innerHTML = buildDurationSelects(original.duration || '');
  c[COL.trainNo].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainNo}\" title=\"${cfg.labels.trainNo}\" value=\"${original.trainNo || ''}\">`;
  c[COL.startStation].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startStation}\" title=\"${cfg.labels.startStation}\" value=\"${original.startStation || ''}\">`;
  c[COL.startCity].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startCity}\" title=\"${cfg.labels.startCity}\" value=\"${original.startCity || ''}\">`;
  c[COL.endStation].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endStation}\" title=\"${cfg.labels.endStation}\" value=\"${original.endStation || ''}\">`;
  c[COL.endCity].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endCity}\" title=\"${cfg.labels.endCity}\" value=\"${original.endCity || ''}\">`;
  c[COL.seatClass].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.seatClass}\" title=\"${cfg.labels.seatClass}\" value=\"${original.seatClass || ''}\">`;
  c[COL.trainType].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainType}\" title=\"${cfg.labels.trainType}\" value=\"${original.trainType || ''}\">`;
  c[COL.bureau].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.bureau}\" title=\"${cfg.labels.bureau}\" value=\"${original.bureau || ''}\">`;
  c[COL.cost].innerHTML = `<input class=\"inline-input\" type=\"number\" step=\"0.01\" placeholder=\"费用 (RMB)\" title=\"费用 (RMB)\" value=\"${original.cost || ''}\">`;
  c[COL.distance].innerHTML = `<input class=\"inline-input\" type=\"number\" step=\"1\" placeholder=\"里程 (km)\" title=\"里程 (km)\" value=\"${original.distance || ''}\">`;
  c[COL.rmbPerKm].textContent = original.pricePerKm || '';
  c[COL.notes].innerHTML = `<input class=\"inline-input\" type=\"text\" placeholder=\"备注\" title=\"备注\" value=\"${original.notes || ''}\">`;

  // 操作按钮替换为 保存/取消
  c[COL.actions].innerHTML = `
        <button class="save">保存</button>
        <button class="cancel">取消</button>
      `;

  // 单价和速度联动
  const updateRowCalculations = () => {
    const cost = parseFloat(c[COL.cost].querySelector('input').value) || 0;
    const dist = parseFloat(c[COL.distance].querySelector('input').value) || 0;
    c[COL.rmbPerKm].textContent = dist > 0 ? (cost / dist).toFixed(4) : '';

    // Speed
    const durationMins = readDurationFromRowCell(c[COL.duration]);
    const mins = parseDurationToMinutes(durationMins);
    if (dist > 0 && mins > 0) {
      c[COL.speed].textContent = (dist / (mins / 60)).toFixed(1);
    } else {
      c[COL.speed].textContent = '';
    }
  };
  c[COL.cost].querySelector('input').addEventListener('input', updateRowCalculations);
  c[COL.distance].querySelector('input').addEventListener('input', updateRowCalculations);
  // Also listen to duration changes
  const durationCell = c[COL.duration];
  durationCell.querySelectorAll('select').forEach(sel => sel.addEventListener('change', updateRowCalculations));

  // Trigger initial calculation
  updateRowCalculations();

  // 保存/取消
  c[COL.actions].querySelector('.save').addEventListener('click', () => saveInlineEdit(tr));
  c[COL.actions].querySelector('.cancel').addEventListener('click', () => cancelInlineEdit(tr));
}

function collectRowData(tr) {
  const c = tr.cells;
  const getVal = (idx) => {
    const el = c[idx].querySelector('input');
    return el ? el.value.trim() : c[idx].innerText.trim();
  };
  const getDurationVal = (idx) => readDurationFromRowCell(c[idx]);
  const cost = parseFloat(getVal(COL.cost)) || 0;
  const distance = parseFloat(getVal(COL.distance)) || 0;
  return {
    date: getVal(COL.date),
    time: getVal(COL.time),
    duration: getDurationVal(COL.duration),
    trainNo: getVal(COL.trainNo),
    startStation: getVal(COL.startStation),
    startCity: getVal(COL.startCity),
    endStation: getVal(COL.endStation),
    endCity: getVal(COL.endCity),
    seatClass: getVal(COL.seatClass),
    trainType: getVal(COL.trainType),
    bureau: getVal(COL.bureau),
    cost,
    distance,
    notes: getVal(COL.notes)
  };
}

function renderRowFromData(tr, recordData) {
  const rpk = recordData.distance > 0 ? (recordData.cost / recordData.distance).toFixed(4) : '';
  tr.cells[COL.date].textContent = recordData.date || '';
  tr.cells[COL.time].textContent = recordData.time || '';
  tr.cells[COL.duration].textContent = recordData.duration || '';
  tr.cells[COL.trainNo].textContent = recordData.trainNo || '';
  tr.cells[COL.startStation].textContent = recordData.startStation || '';
  tr.cells[COL.startCity].textContent = recordData.startCity || '';
  tr.cells[COL.endStation].textContent = recordData.endStation || '';
  tr.cells[COL.endCity].textContent = recordData.endCity || '';
  tr.cells[COL.seatClass].textContent = recordData.seatClass || '';
  tr.cells[COL.trainType].textContent = recordData.trainType || '';
  tr.cells[COL.bureau].textContent = recordData.bureau || '';
  tr.cells[COL.cost].textContent = recordData.cost.toFixed(2);
  tr.cells[COL.distance].textContent = recordData.distance || 0;
  tr.cells[COL.rmbPerKm].textContent = rpk;

  // Speed Calculation
  const durationMins = parseDurationToMinutes(recordData.duration);
  let speed = '';
  if ((recordData.distance || 0) > 0 && durationMins > 0) {
    speed = ((recordData.distance || 0) / (durationMins / 60)).toFixed(1);
  }
  tr.cells[COL.speed].textContent = speed;

  tr.cells[COL.notes].textContent = recordData.notes || '';
  tr.cells[COL.actions].innerHTML = `
        <div class="action-menu">
          <button class="action-menu-btn">⋮</button>
          <div class="action-menu-dropdown">
            <button class="modify">✏️ 修改</button>
            <button class="insert">➕ 插入</button>
            <button class="redraw">🔄 重新画线</button>
            <button class="delete">🗑️ 删除</button>
          </div>
        </div>
      `;
  attachRowEvents(tr);

  // Add dropdown toggle functionality
  const menuBtn = tr.querySelector('.action-menu-btn');
  const menu = tr.querySelector('.action-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.action-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });
  }
}

function saveInlineEdit(tr) {
  const rec = collectRowData(tr);
  if (!rec.startStation || !rec.endStation) {
    const cfg = getEntityConfig();
    alert(`${cfg.labels.startStation} 和 ${cfg.labels.endStation} 不能为空！`);
    return;
  }
  const original = tr._editOriginal || {};
  const routeChanged = (
    original.startStation !== rec.startStation ||
    original.startCity !== rec.startCity ||
    original.endStation !== rec.endStation ||
    original.endCity !== rec.endCity
  );
  // 找到对应记录索引
  const rowIndex = Array.from(tbody.children).indexOf(tr);
  if (rowIndex === -1) return;
  const record = records[rowIndex] || {};
  // 更新基础字段
  record.date = rec.date;
  record.time = rec.time;
  record.duration = rec.duration;
  record.trainNo = rec.trainNo;
  record.startStation = rec.startStation;
  record.startCity = rec.startCity;
  record.endStation = rec.endStation;
  record.endCity = rec.endCity;
  record.seatClass = rec.seatClass;
  record.trainType = rec.trainType;
  record.bureau = rec.bureau;
  record.cost = rec.cost;
  record.distance = rec.distance;
  record.notes = rec.notes;
  if (routeChanged) {
    // 清除旧路径相关字段，待会重新生成
    delete record.pathWGS;
    delete record.pathGCJ;
    delete record.pathIndex;
    delete record.startLon; delete record.startLat;
    delete record.endLon; delete record.endLat;
    // 移除旧覆盖物
    if (tr._overlays) {
      tr._overlays.forEach(o => {
        try {
          if (currentMapType === 'amap') {
            if (o.setMap) o.setMap(null);
            if (amapInstance && amapInstance.remove) amapInstance.remove(o);
          } else if (currentMapType === 'google') {
            if (o.setMap) o.setMap(null);
          } else if (currentMapType === 'leaflet') {
            if (o.remove) o.remove();
          }
        } catch { }
      });
      tr._overlays = [];
    }
  }
  // 回写到行展示
  renderRowFromData(tr, record);
  // 保存 & 局部重绘
  if (routeChanged) {
    // 仅重绘该行
    drawPath(tr, record); // 内部会在生成后 saveRecords()
  } else {
    // 线路未变，若之前仍有覆盖物则无需动作；若被用户修改其它字段，保持路径
    saveRecords();
  }
  // 更新统计与图例（不触发全量重绘）
  try { updateYearLegend && updateYearLegend(); } catch { }
  try { updateStats && updateStats(); } catch { }
}

function cancelInlineEdit(tr) {
  if (tr._isNewRow) {
    tr.remove();
    updateSequenceNumbers();
    return;
  }
  const o = tr._editOriginal;
  if (o) {
    renderRowFromData(tr, {
      date: o.date, time: o.time, duration: o.duration, trainNo: o.trainNo,
      startStation: o.startStation, startCity: o.startCity, endStation: o.endStation, endCity: o.endCity,
      seatClass: o.seatClass, trainType: o.trainType, bureau: o.bureau,
      cost: parseFloat(o.cost) || 0, distance: parseFloat(o.distance) || 0, notes: o.notes
    });
  }
}

function insertInlineAfter(tr) {
  const newTr = document.createElement('tr');
  const cfg = getEntityConfig();
  newTr.innerHTML = `
        <td></td>
        <td><input class=\"inline-input\" type=\"date\" placeholder=\"日期\" title=\"日期\"></td>
        <td><input class=\"inline-input\" type=\"time\" placeholder=\"时间\" title=\"时间\"></td>
  <td>${buildDurationSelects('00:00')}</td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainNo}\" title=\"${cfg.labels.trainNo}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startStation}\" title=\"${cfg.labels.startStation}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startCity}\" title=\"${cfg.labels.startCity}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endStation}\" title=\"${cfg.labels.endStation}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endCity}\" title=\"${cfg.labels.endCity}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.seatClass}\" title=\"${cfg.labels.seatClass}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainType}\" title=\"${cfg.labels.trainType}\"></td>
        <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.bureau}\" title=\"${cfg.labels.bureau}\"></td>
        <td><input class=\"inline-input\" type=\"number\" step=\"0.01\" placeholder=\"费用 (RMB)\" title=\"费用 (RMB)\" value=\"0\"></td>
        <td><input class="inline-input" type="number" step="1" placeholder="里程 (km)" title="里程 (km)" value="0"></td>
        <td></td><!-- RMB/km -->
        <td></td><!-- Speed -->
        <td><input class="inline-input" type="text" placeholder="备注" title="备注"></td>
        <td>
          <button class="save">保存</button>
          <button class="cancel">取消</button>
        </td>
      `;
  // 插入到当前行后
  if (tr.nextSibling) tbody.insertBefore(newTr, tr.nextSibling); else tbody.appendChild(newTr);
  newTr._isNewRow = true;
  updateSequenceNumbers();

  // 单价和速度联动
  const c = newTr.cells;
  const updateRowCalculations = () => {
    const cost = parseFloat(c[COL.cost].querySelector('input').value) || 0;
    const dist = parseFloat(c[COL.distance].querySelector('input').value) || 0;
    // RPK
    c[COL.rmbPerKm].textContent = dist > 0 ? (cost / dist).toFixed(4) : '';

    // Speed
    // Duration is in cell 3. It contains SELECTs.
    const durationMins = readDurationFromRowCell(c[COL.duration]); // Need to ensure this function works with new row structure
    // readDurationFromRowCell returns "HH:MM". We need to parse it.
    const mins = parseDurationToMinutes(durationMins);
    if (dist > 0 && mins > 0) {
      c[COL.speed].textContent = (dist / (mins / 60)).toFixed(1);
    } else {
      c[COL.speed].textContent = '';
    }
  };
  c[COL.cost].querySelector('input').addEventListener('input', updateRowCalculations);
  c[COL.distance].querySelector('input').addEventListener('input', updateRowCalculations);
  // Also listen to duration changes
  const durationCell = c[COL.duration];
  durationCell.querySelectorAll('select').forEach(sel => sel.addEventListener('change', updateRowCalculations));

  c[COL.actions].querySelector('.save').addEventListener('click', () => {
    const rec = collectRowData(newTr);
    if (!rec.startStation || !rec.endStation) {
      const cfg = getEntityConfig();
      alert(`${cfg.labels.startStation} 和 ${cfg.labels.endStation} 不能为空！`);
      return;
    }
    // 渲染静态单元格
    renderRowFromData(newTr, rec);
    // 更新序号
    updateSequenceNumbers();
    // 计算插入位置并写入 records（保持其他记录的路径缓存不丢失）
    const idx = Array.from(tbody.children).indexOf(newTr);
    if (idx === -1) return; // 理论不应发生
    records.splice(idx, 0, { ...rec });
    saveRecords();
    // 仅绘制新增这一条线路
    try { drawPath(newTr, records[idx]); } catch (e) { console.warn('绘制新增线路失败', e); }
    // 更新图例与统计
    try { updateYearLegend && updateYearLegend(); } catch { }
    try { updateStats && updateStats(); } catch { }
  });

  c[COL.actions].querySelector('.cancel').addEventListener('click', () => {
    newTr.remove();
    updateSequenceNumbers();
  });
}

// （已移除国际/中文判断函数：仅使用统一的 Nominatim 查询）

// ===================== 仅使用 Nominatim 的正向地理编码 =====================
// 需求：只调用 https://nominatim.openstreetmap.org/search 获取 WGS84，再按需中国境内转换 GCJ-02 用于高德底图。不得调用谷歌/高德官方地理编码。
// geocode(station, city) 返回 WGS84 [lon, lat]，转换在使用处（绘制到高德时）进行。

function geocode(station, city) {
  if (!station) return Promise.reject(new Error('station 为空'));
  // 调整：只使用用户输入的站名原文（去前后空格），不再自动补“站”字，也不拼接城市
  const query = station.trim();
  const cacheKey = `nominatim_${query}`;
  if (geocodeCache[cacheKey]) {
    return Promise.resolve(geocodeCache[cacheKey]); // 存的即 WGS84
  }
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('addressdetails', '0');
  return fetch(url.toString(), { headers: { 'Accept-Language': 'zh-CN,en;q=0.8', 'User-Agent': 'train-records-nominatim-demo' } })
    .then(r => { if (!r.ok) throw new Error('Nominatim 网络错误 ' + r.status); return r.json(); })
    .then(data => {
      if (!Array.isArray(data) || !data.length) throw new Error('未找到: ' + query);
      const item = data[0];
      const lat = parseFloat(item.lat), lon = parseFloat(item.lon);
      if (isNaN(lat) || isNaN(lon)) throw new Error('Nominatim 返回坐标无效');
      geocodeCache[cacheKey] = [lon, lat];
      saveGeocodeCache();
      return geocodeCache[cacheKey];
    });
}

function buildGeocodeQuery(city, station) {
  if (!station) return null;
  return station.trim(); // 仅原始站名，不自动补“站”
}

// 坐标系转换工具（WGS84 -> GCJ-02），仅在高德绘图且位于中国范围时使用
function isInChina(lon, lat) { return lon > 73 && lon < 135.05 && lat > 3 && lat < 53.9; }
function wgs84ToGcj02(lon, lat) {
  if (!isInChina(lon, lat)) return [lon, lat];
  const a = 6378245.0, ee = 0.00669342162296594323;
  let dLat = transformLat(lon - 105.0, lat - 35.0), dLon = transformLon(lon - 105.0, lat - 35.0);
  const radLat = lat / 180 * Math.PI; let magic = Math.sin(radLat); magic = 1 - ee * magic * magic; const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI); dLon = (dLon * 180) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lon + dLon, lat + dLat];
}
function transformLat(x, y) { let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x)); ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3; ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3; ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3; return ret; }
function transformLon(x, y) { let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x)); ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3; ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3; ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3; return ret; }
// ================== Nominatim-only 结束 ==================

// 通用延迟工具
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Draw the path on the map for a given record - 仅使用 Nominatim (WGS84) + 中国境内 WGS→GCJ 转换
async function drawPath(tr, record) {
  if (!record.startStation || !record.endStation) return;
  const routeKey = [record.startStation, record.endStation].sort().join('→');
  const year = record.date ? record.date.substring(0, 4) : '';
  let geocodeCount = 0; // 统计本条记录实际调用了多少次 geocode，用于节流控制

  // 如果已有路径数据，直接恢复
  if (Array.isArray(record.pathWGS) && record.pathWGS.length) {
    const strokeColor = getYearColor(year);
    const pathIndex = record.pathIndex || 0;
    counts[routeKey] = Math.max(counts[routeKey] || 0, pathIndex + 1);
    let overlays = [];
    try {
      if (currentMapType === 'amap') {
        // 存了 GCJ 优先，否则把 WGS 转 GCJ
        let gcjPath = record.pathGCJ;
        if (!Array.isArray(gcjPath) || !gcjPath.length) {
          // 转换整条路径
          gcjPath = record.pathWGS.map(p => isInChina(p[0], p[1]) ? wgs84ToGcj02(p[0], p[1]) : p);
        }
        const polyline = new AMap.Polyline({ path: gcjPath, isOutline: false, strokeColor, strokeWeight: 2, strokeOpacity: 0.9, strokeStyle: 'solid', zIndex: 50 });

        // Interaction Events (AMap)
        polyline.on('mouseover', () => {
          polyline.setOptions({ strokeWeight: 5, zIndex: 100 });
          tr.classList.add('highlight-row');
        });
        polyline.on('mouseout', () => {
          polyline.setOptions({ strokeWeight: 2, zIndex: 50 });
          tr.classList.remove('highlight-row');
        });
        polyline.on('click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });

        amapInstance.add(polyline); overlays.push(polyline);
        if (gcjPath.length) {
          const mid = gcjPath[Math.floor(gcjPath.length / 2)];
          const label = new AMap.Text({ text: year, position: mid, style: { 'font-size': '12px', 'font-weight': 'bold', 'color': strokeColor, 'background-color': 'rgba(255,255,255,0.8)', 'border': '1px solid ' + strokeColor, 'border-radius': '3px', 'padding': '2px 4px', 'text-align': 'center' }, offset: [0, -10], zIndex: 50 });
          amapInstance.add(label); overlays.push(label);
        }
      } else if (currentMapType === 'google') {
        const googlePath = record.pathWGS.map(p => ({ lat: p[1], lng: p[0] }));
        const polyline = new google.maps.Polyline({ path: googlePath, geodesic: false, strokeColor: getYearColor(year), strokeOpacity: 0.9, strokeWeight: 2, zIndex: 50 });

        // Interaction Events (Google Maps)
        google.maps.event.addListener(polyline, 'mouseover', () => {
          polyline.setOptions({ strokeWeight: 5, zIndex: 100 });
          tr.classList.add('highlight-row');
        });
        google.maps.event.addListener(polyline, 'mouseout', () => {
          polyline.setOptions({ strokeWeight: 2, zIndex: 50 });
          tr.classList.remove('highlight-row');
        });
        google.maps.event.addListener(polyline, 'click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });

        polyline.setMap(googleMap); overlays.push(polyline);
      } else if (currentMapType === 'leaflet') {
        // 使用 Leaflet 绘制已存路径
        const latLngs = record.pathWGS.map(p => [p[1], p[0]]); // Leaflet uses [lat, lon]
        const polyline = L.polyline(latLngs, {
          color: strokeColor,
          weight: 2,
          opacity: 0.9,
          smoothFactor: 1
        }).addTo(leafletMap);

        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: 5 });
          polyline.bringToFront();
          tr.classList.add('highlight-row');
        });
        polyline.on('mouseout', () => {
          polyline.setStyle({ weight: 2 });
          tr.classList.remove('highlight-row');
        });
        polyline.on('click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });
        overlays.push(polyline);
      }
      tr._overlays = overlays;
      const shouldShow = isUserDeselectedAll ? false : (selectedYears.size === 0 || selectedYears.has(year));
      if (!shouldShow) overlays.forEach(o => { if (o.setOptions) o.setOptions({ strokeOpacity: 0, zIndex: -1 }); else if (o.hide) o.hide(); });
      return; // 已恢复
    } catch (e) { console.warn('恢复已存路径失败，尝试重新生成:', e.message); }
  }

  // 无路径数据则生成
  try {
    let startLon = record.startLon, startLat = record.startLat, endLon = record.endLon, endLat = record.endLat;
    if (!(Number.isFinite(startLon) && Number.isFinite(startLat))) {
      const sw = await geocode(record.startStation, record.startCity);
      startLon = sw[0]; startLat = sw[1];
      record.startLon = startLon; record.startLat = startLat;
      geocodeCount++;
    }
    if (!(Number.isFinite(endLon) && Number.isFinite(endLat))) {
      const ew = await geocode(record.endStation, record.endCity);
      endLon = ew[0]; endLat = ew[1];
      record.endLon = endLon; record.endLat = endLat;
      geocodeCount++;
    }
    // 计算或使用既有 pathIndex
    let pathIndex = record.pathIndex;
    if (!Number.isInteger(pathIndex)) {
      counts[routeKey] = (counts[routeKey] || 0) + 1;
      pathIndex = counts[routeKey] - 1;
      record.pathIndex = pathIndex;
    } else {
      counts[routeKey] = Math.max(counts[routeKey] || 0, pathIndex + 1);
    }
    const strokeColor = getYearColor(year);
    // 判断是否为反向路线（相对于 routeKey 的排序顺序）
    // 如果 start > end，说明当前方向与 routeKey (A->B) 相反，标记为 isReverse
    const isReverse = record.startStation > record.endStation;

    // 生成 WGS 曲线
    const wgsPath = generateArcPath([startLon, startLat], [endLon, endLat], pathIndex, isReverse);
    record.pathWGS = wgsPath.map(p => [p[0], p[1]]);
    let overlays = [];
    if (currentMapType === 'amap') {
      const gcjPath = wgsPath.map(p => isInChina(p[0], p[1]) ? wgs84ToGcj02(p[0], p[1]) : p);
      record.pathGCJ = gcjPath.map(p => [p[0], p[1]]);
      const polyline = new AMap.Polyline({ path: gcjPath, isOutline: false, strokeColor, strokeWeight: 2, strokeOpacity: 0.9, strokeStyle: 'solid' });
      amapInstance.add(polyline); overlays.push(polyline);
      if (gcjPath.length) {
        const mid = gcjPath[Math.floor(gcjPath.length / 2)];
        const label = new AMap.Text({ text: year, position: mid, style: { 'font-size': '12px', 'font-weight': 'bold', 'color': strokeColor, 'background-color': 'rgba(255,255,255,0.8)', 'border': '1px solid ' + strokeColor, 'border-radius': '3px', 'padding': '2px 4px', 'text-align': 'center' }, offset: [0, -10] });
        amapInstance.add(label); overlays.push(label);
      }
    } else if (currentMapType === 'google') {
      const googlePath = wgsPath.map(p => ({ lat: p[1], lng: p[0] }));
      const polyline = new google.maps.Polyline({ path: googlePath, geodesic: false, strokeColor, strokeOpacity: 0.9, strokeWeight: 2 });
      polyline.setMap(googleMap); overlays.push(polyline);
    } else if (currentMapType === 'leaflet') {
      // Leaflet 绘制新路径
      const latLngs = wgsPath.map(p => [p[1], p[0]]);
      const polyline = L.polyline(latLngs, {
        color: strokeColor,
        weight: 2,
        opacity: 0.9,
        smoothFactor: 1
      }).addTo(leafletMap);

      // Bind Interactions
      polyline.on('mouseover', () => { polyline.setStyle({ weight: 5 }); polyline.bringToFront(); tr.classList.add('highlight-row'); });
      polyline.on('mouseout', () => { polyline.setStyle({ weight: 2 }); tr.classList.remove('highlight-row'); });
      polyline.on('click', () => { tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); tr.classList.add('highlight-row'); setTimeout(() => tr.classList.remove('highlight-row'), 1500); });

      overlays.push(polyline);
    }
    tr._overlays = overlays;
    const shouldShow = isUserDeselectedAll ? false : (selectedYears.size === 0 || selectedYears.has(year));
    if (!shouldShow) overlays.forEach(o => { if (o.setOptions) o.setOptions({ strokeOpacity: 0, zIndex: -1 }); else if (o.hide) o.hide(); });
    saveRecords(); // 不区分 created，统一保存（可能只是恢复了 pathIndex）
    // 节流：只有发生地理编码（至少一次 geocode 调用）才等待；等待时间 500ms
    if (geocodeCount > 0) await sleep(500);
  } catch (e) {
    console.error('生成线路失败:', e.message);
    try {
      record._pathError = e.message || '未知错误';
      addPathErrorUI(record, e.message);
    } catch (_) { }
  }
}

// 生成贝塞尔弧线路径（通用函数）
function generateArcPath(startCoords, endCoords, pathIndex = 0, isReverse = false) {
  const [x1, y1] = startCoords;
  const [x2, y2] = endCoords;
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  let ux = -dy / len, uy = dx / len;

  // 减小基础弧度系数
  const base = 0.15 * len;
  const factor = base * (1 + pathIndex * 0.15);

  // 伪随机决定初始方向：基于坐标和的哈希
  // 这样同一条线路（起终点相同）的方向是固定的，但不同线路的方向是随机的
  const seed = Math.floor((x1 + y1 + x2 + y2) * 10000);
  const randomSide = seed % 2;

  // 结合 pathIndex、随机因子和反向标志决定方向
  // isReverse 用于确保 A->B 和 B->A 在 pathIndex 递增时能正确分列两侧，而不是重叠
  if ((pathIndex + randomSide + (isReverse ? 1 : 0)) % 2) { ux = -ux; uy = -uy; }

  // 生成控制点
  const controlPoints = [];
  for (let i = 0; i < 5; i++) {
    const t = (i + 1) / 6;
    const cx = x1 + dx * t + ux * factor * Math.sin(Math.PI * t) * 0.8;
    const cy = y1 + dy * t + uy * factor * Math.sin(Math.PI * t) * 0.8;
    controlPoints.push([cx, cy]);
  }

  const seg = 120;
  const path = [];

  // 六阶贝塞尔曲线
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    let point = [0, 0];
    let binomialCoef = 1;

    // 起点
    point[0] += Math.pow(1 - t, 6) * x1;
    point[1] += Math.pow(1 - t, 6) * y1;

    // 控制点
    for (let j = 0; j < 5; j++) {
      binomialCoef = binomialCoef * (6 - j) / (j + 1);
      const factor = binomialCoef * Math.pow(t, j + 1) * Math.pow(1 - t, 5 - j);
      point[0] += factor * controlPoints[j][0];
      point[1] += factor * controlPoints[j][1];
    }

    // 终点
    point[0] += Math.pow(t, 6) * x2;
    point[1] += Math.pow(t, 6) * y2;

    path.push(point);
  }

  return path.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
}

// Add a record to the table and draw it on the map
function addRecordToTable(recordData, insertAfterTr = null) {
  const tr = document.createElement('tr');
  const rpk = recordData.distance > 0 ? (recordData.cost / recordData.distance).toFixed(4) : '';
  tr.innerHTML = `
        <td></td> <!-- Seq # updated later -->
        <td>${recordData.date}</td>
        <td>${recordData.time}</td>
        <td>${recordData.duration}</td>
        <td>${recordData.trainNo}</td>
        <td>${recordData.startStation}</td>
        <td>${recordData.startCity}</td>
        <td>${recordData.endStation}</td>
        <td>${recordData.endCity}</td>
        <td>${recordData.seatClass}</td>
        <td>${recordData.trainType}</td>
        <td>${recordData.bureau}</td>
        <td>${recordData.cost.toFixed(2)}</div>
        <td>${recordData.distance}</td>
        <td>${rpk}</td>
        <td>${(() => {
      const durationMins = parseDurationToMinutes(recordData.duration);
      if (recordData.distance > 0 && durationMins > 0) {
        return (recordData.distance / (durationMins / 60)).toFixed(1);
      }
      return '';
    })()}</td>
        <td>${recordData.notes}</td>
        <td>
          <div class="action-menu">
            <button class="action-menu-btn">⋮</button>
            <div class="action-menu-dropdown">
              <button class="modify">✏️ 修改</button>
              <button class="insert">➕ 插入</button>
              <button class="redraw">🔄 重新画线</button>
              <button class="delete">🗑️ 删除</button>
            </div>
          </div>
        </td>
      `;

  // 修复插入逻辑
  if (insertAfterTr && insertAfterTr.parentNode) {
    // 插入到指定行的后面
    if (insertAfterTr.nextSibling) {
      tbody.insertBefore(tr, insertAfterTr.nextSibling);
    } else {
      tbody.appendChild(tr);
    }
  } else {
    // 默认添加到末尾
    tbody.appendChild(tr);
  }

  attachRowEvents(tr);

  // Add dropdown toggle functionality
  const menuBtn = tr.querySelector('.action-menu-btn');
  const menu = tr.querySelector('.action-menu');
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Close all other menus
      document.querySelectorAll('.action-menu.open').forEach(m => {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
    });
  }

  // 实时绘制路径，无论地图是否完全加载
  tr._record = recordData;
  drawPath(tr, recordData);

  // 更新图例
  updateYearLegend();

  return tr;
}

// 地点标记切换已移除

// 新增：重新绘制所有路径
// 全量重新绘制：删除所有覆盖物 + 清除每条记录的路径缓存字段 + 重新生成
async function redrawAllPaths(force = false) {
  if (force) {
    // 1. 清除地图上现有覆盖物
    Array.from(tbody.children).forEach(tr => {
      if (tr._overlays) {
        tr._overlays.forEach(o => {
          try {
            if (currentMapType === 'amap') {
              if (o.setMap) o.setMap(null);
              if (amapInstance && amapInstance.remove) { try { amapInstance.remove(o); } catch (e) { } }
            } else if (currentMapType === 'google') {
              if (o.setMap) o.setMap(null);
            } else if (currentMapType === 'leaflet') {
              if (o.remove) o.remove();
            }
          } catch { }
        });
      }
      tr._overlays = [];
    });
    // 2. 清除偏移计数器
    Object.keys(counts).forEach(key => delete counts[key]);
    // 3. 清除每条记录的路径/坐标缓存，使其强制重新 geocode + 生成
    records.forEach(r => {
      delete r.pathWGS; delete r.pathGCJ; delete r.pathIndex;
      delete r.startLon; delete r.startLat; delete r.endLon; delete r.endLat;
    });
    saveRecords();
  }
  // 4. 逐条重新绘制（会自动节流 geocode）
  const allRows = Array.from(tbody.children);
  for (let i = 0; i < allRows.length; i++) {
    const tr = allRows[i];
    const rec = records[i];
    if (rec && rec.startStation && rec.endStation) {
      try { await drawPath(tr, rec); } catch (error) {
        const route = `${rec.startCity || ''}${rec.startStation} → ${rec.endCity || ''}${rec.endStation}`;
        console.error(`重绘路径失败 [${route}]:`, error.message);
      }
    }
  }
  updateYearLegend();
}

function forceRedrawAllPaths() {
  if (!confirm('确定要重新生成所有线路？\n这将清除已缓存的路径与坐标并重新请求。')) return;
  redrawAllPaths(true);
}

// （路径单独缓存逻辑已移除，路径数据直接伴随记录保存）

// --- Initial Load & Event Listeners ---

// Set initial theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark', savedTheme === 'dark');
themeToggle.textContent = savedTheme === 'dark' ? '切换浅色模式' : '切换暗色模式';

// 地点标记显示设置已移除

// Theme toggle listener
themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  themeToggle.textContent = isDark ? '切换浅色模式' : '切换暗色模式';
  updateMapTheme();
});

// 侧边栏折叠/展开
function applySidebarState(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  sidebarToggleBtn.textContent = collapsed ? '显示侧边栏' : '隐藏侧边栏';
  localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  setTimeout(refreshMapAfterLayoutChange, 50);
}
sidebarToggleBtn.addEventListener('click', () => {
  const collapsed = !(document.body.classList.contains('sidebar-collapsed'));
  applySidebarState(collapsed);
});

// 实体切换
function reloadForEntity(entity) {
  currentEntity = entity;
  localStorage.setItem('entity', entity);
  applyEntityUI(entity);
  // 切换实体时重置线路偏移计数，确保 plane 与 train 独立
  Object.keys(counts).forEach(k => delete counts[k]);
  // 清空错误提示盒（若已初始化）
  try { if (typeof pathErrorList !== 'undefined') { pathErrorList.innerHTML = ''; } if (typeof pathErrorBox !== 'undefined') { pathErrorBox.style.display = 'none'; } } catch (e) { }
  // 切换模式前，清除当前地图上的所有覆盖物（线条/标记/标签）
  clearAllPaths();
  // 记录当前地图视图
  let center = null, zoom = null;
  try {
    if (currentMapType === 'amap' && amapInstance) {
      const c = amapInstance.getCenter();
      center = { lat: c.lat, lng: c.lng };
      zoom = amapInstance.getZoom();
    } else if (currentMapType === 'google' && googleMap) {
      const c = googleMap.getCenter();
      center = { lat: c.lat(), lng: c.lng() };
      zoom = googleMap.getZoom();
    }
  } catch { }
  // 彻底重建地图（不改变地图类型），避免残留状态
  try {
    if (currentMapType === 'amap') {
      if (amapInstance) { amapInstance.destroy(); amapInstance = null; }
      amapInstance = initAmapMap();
      map = amapInstance;
      if (center) { amapInstance.setCenter([center.lng, center.lat]); }
      if (zoom) { amapInstance.setZoom(zoom); }
    } else if (currentMapType === 'google') {
      const container = document.getElementById('mapContainer');
      if (container) container.innerHTML = '';
      googleMap = initGoogleMap();
      map = googleMap;
      if (googleMap && center) { googleMap.setCenter(center); }
      if (googleMap && zoom) { googleMap.setZoom(zoom); }
    } else if (currentMapType === 'leaflet') {
      if (leafletMap) { leafletMap.remove(); leafletMap = null; }
      document.getElementById('mapContainer').innerHTML = '';
      leafletMap = initLeafletMap();
      map = leafletMap;
      if (center) leafletMap.setView([center.lat, center.lng], zoom || 5);
      // Sync theme
      updateMapTheme();
    }
  } catch (e) { console.warn('重建地图失败:', e); }
  // 重置年份选择状态，避免跨模式残留
  selectedYears.clear();
  isUserDeselectedAll = false;
  // 重新加载记录
  records = JSON.parse(localStorage.getItem(getStorageKey())) || [];
  // 清空表格并渲染
  tbody.innerHTML = '';
  // 渲染表格行（不立即绘制路径，避免地图状态未就绪）
  records.forEach(rec => {
    const tr = document.createElement('tr');
    const rpk = rec.distance > 0 ? (rec.cost / rec.distance).toFixed(4) : '';
    tr.innerHTML = `
          <td></td>
          <td>${rec.date || ''}</td>
          <td>${rec.time || ''}</td>
          <td>${rec.duration || ''}</td>
          <td>${rec.trainNo || ''}</td>
          <td>${rec.startStation || ''}</td>
          <td>${rec.startCity || ''}</td>
          <td>${rec.endStation || ''}</td>
          <td>${rec.endCity || ''}</td>
          <td>${rec.seatClass || ''}</td>
          <td>${rec.trainType || ''}</td>
          <td>${rec.bureau || ''}</td>
          <td>${(rec.cost || 0).toFixed(2)}</td>
          <td>${rec.distance || 0}</td>
          <td>${rpk}</td>
          <td>${(() => {
        const durationMins = parseDurationToMinutes(rec.duration);
        if ((rec.distance || 0) > 0 && durationMins > 0) {
          return ((rec.distance || 0) / (durationMins / 60)).toFixed(1);
        }
        return '';
      })()}</td>
          <td>${rec.notes || ''}</td>
          <td>
            <div class="action-menu">
              <button class="action-menu-btn">⋮</button>
              <div class="action-menu-dropdown">
                <button class="modify">✏️ 修改</button>
                <button class="insert">➕ 插入</button>
                <button class="redraw">🔄 重新画线</button>
                <button class="delete">🗑️ 删除</button>
              </div>
            </div>
          </td>
        `;
    tbody.appendChild(tr);
    tr._record = rec;
    attachRowEvents(tr);

    // Add dropdown toggle functionality
    const menuBtn = tr.querySelector('.action-menu-btn');
    const menu = tr.querySelector('.action-menu');
    if (menuBtn && menu) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.action-menu.open').forEach(m => {
          if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
    }
  });
  updateSequenceNumbers();
  updateSummaryPanels();
  updateYearLegend();
  // 同步刷新出行统计，保证火车/飞机模式下相互独立
  updateStats();
  // 稍后恢复绘制路径：不强制清空路径缓存，直接按已有 pathWGS 恢复
  setTimeout(() => { redrawAllPaths(false); }, 100);
}

modeTrainBtn.addEventListener('click', () => reloadForEntity('train'));
modePlaneBtn.addEventListener('click', () => reloadForEntity('plane'));

// Map toggle listener
// Map select listener
mapSelect.addEventListener('change', (e) => {
  const targetType = e.target.value;
  console.log(`地图切换: ${currentMapType} → ${targetType}`);

  // 如果要切换到谷歌地图，先检查API是否已加载
  if (targetType === 'google' && !googleMapsLoaded) {
    console.warn('谷歌地图API尚未加载完成，跳过直接切换到 OSM');
    // 自动切到 Leaflet
    if (mapSelect) mapSelect.value = 'leaflet';
    switchMapType('leaflet');
    return;
  }

  switchMapType(targetType);
});

// Set initial selection
if (mapSelect) mapSelect.value = currentMapType;

// 已移除地点标记按钮与监听器

// 总结面板标签切换事件监听器
document.querySelectorAll('.summary-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // 移除所有活动状态
    document.querySelectorAll('.summary-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.summary-content').forEach(c => c.classList.remove('active'));
    // 添加活动状态
    tab.classList.add('active');
    const tabName = tab.dataset.tab;
    document.getElementById(tabName + 'Summary').classList.add('active');

    // 根据标签更新图表、统计和地图
    if (tabName === 'yearly') {
      const selectedYear = yearSelect.value;
      if (selectedYear) {
        // 先设置地图图例：只选中当前年份
        selectedYears.clear();
        isUserDeselectedAll = false;
        selectedYears.add(selectedYear);

        // 然后更新图表、统计和表格
        updateYearlySummary(selectedYear); // 刷新年度统计面板以绑定最新的点击事件
        createYearlyCharts('monthly', selectedYear);
        createBureauChart(selectedYear);
        createTypeChart(selectedYear);
        updateRouteHeatmap(selectedYear);
        updateRegionStats(selectedYear);
        rerenderTable(selectedYear);
        updateYearLegend();
      }
    } else {
      // 历史总结：先恢复全选状态
      selectedYears.clear();
      isUserDeselectedAll = false;
      // 预先填充所有年份（这样rerenderTable绘制时就能正确显示）
      const yearStats = {};
      records.forEach(record => {
        const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
        yearStats[year] = true;
      });
      Object.keys(yearStats).forEach(year => selectedYears.add(year));

      // 然后更新图表、统计和表格
      updateAllTimeSummary(); // 刷新历史统计面板以绑定最新的点击事件
      createYearlyCharts('yearly');
      createBureauChart();
      createTypeChart();
      updateRouteHeatmap();
      updateRegionStats();
      rerenderTable();
      updateYearLegend();
    }
  });
});

// 年份选择器事件监听器
yearSelect.addEventListener('change', (e) => {
  const selectedYear = e.target.value;
  updateYearlySummary(selectedYear);
  // 如果当前在年度总结标签页，更新图表、统计、表格和地图图例
  const yearlyTab = document.querySelector('.summary-tab[data-tab="yearly"]');
  if (yearlyTab && yearlyTab.classList.contains('active') && selectedYear) {
    // 先设置地图图例：只选中当前年份
    selectedYears.clear();
    isUserDeselectedAll = false;
    selectedYears.add(selectedYear);

    // 然后更新图表、统计和表格
    createYearlyCharts('monthly', selectedYear);
    createBureauChart(selectedYear);
    createTypeChart(selectedYear);
    updateRouteHeatmap(selectedYear);
    updateRegionStats(selectedYear);
    rerenderTable(selectedYear);
    updateYearLegend();
  }
});

// Price calculation listeners（行内模式下可能不存在表单输入）
if (costInput) costInput.addEventListener('input', updatePricePerKm);
if (distanceInput) distanceInput.addEventListener('input', updatePricePerKm);

// CSV导出事件监听 - 修复：添加缺失的事件监听器
document.getElementById('exportCsvBtn').addEventListener('click', () => {
  confirmRun('确定导出当前全部记录为 CSV 文件？', exportToCsv);
});

// CSV导入事件监听
document.getElementById('importCsvBtn').addEventListener('click', () => {
  confirmRun('导入 CSV 可能覆盖/追加记录，继续？\n(导入后请及时校验数据)', () => document.getElementById('importCsvFile').click());
});

document.getElementById('importCsvFile').addEventListener('change', e => {
  if (e.target.files.length > 0) {
    importCsv(e.target.files[0]);
    e.target.value = ''; // 重置文件选择器
  }
});

// Excel导入事件监听
importExcelBtn.addEventListener('click', () => {
  confirmRun('确定导入 Excel 文件？\n(将提示选择“覆盖”或“追加”)', () => importExcelFile.click());
});

importExcelFile.addEventListener('change', e => {
  if (e.target.files.length > 0) {
    importExcel(e.target.files[0]);
    e.target.value = ''; // 重置文件选择器
  }
});

// JSON导出事件监听
exportJsonBtn.addEventListener('click', () => {
  confirmRun('导出 JSON 将包含全部记录及其路径缓存，继续？', exportToJson);
});

// 重新绘制线路按钮
const forceRedrawBtn = document.getElementById('forceRedrawBtn');
if (forceRedrawBtn) {
  forceRedrawBtn.addEventListener('click', () => forceRedrawAllPaths());
}
// 动画回放按钮逻辑
const replayBtn = document.getElementById('replayBtn');
const replayOverlay = document.getElementById('replayOverlay');
const replayMapDiv = document.getElementById('replayMap');
// 新布局按钮
const replayStartBtn = document.getElementById('replayBtnStart');
const replayPauseBtn = document.getElementById('replayBtnPause');
const replayResetBtn = document.getElementById('replayBtnReset');
const replayCloseBtn = document.getElementById('replayCloseBtn');
const replayTotalSpan = document.getElementById('replayTotal');
const replayProgressSpan = document.getElementById('replayProgress');
const replayStatusSpan = document.getElementById('replayStatus');
const replayYearSelect = document.getElementById('replayYearSelect');
const replayModeRadios = document.querySelectorAll('input[name="replayMode"]');
const replayYearModeHint = document.getElementById('replayYearModeHint');
let replayMapInstance = null;
let replayTimer = null;
let replayIndex = 0;
let replayRecords = [];
let replayPaused = false;
let replayAnimationId = null; // Animation frame ID
let sequentialYears = [];
let sequentialPointer = 0;
let isSequentialMode = false;
let replayCurrentYear = '';
let replayYearTotal = 0;
let replayYearDone = 0;
const replayYearProgressBar = document.getElementById('replayYearProgressBar');
const replayYearProgressCnt = document.getElementById('replayYearProgressCnt');
const replayYearProgressTotal = document.getElementById('replayYearProgressTotal');
const replayCurrentRouteBox = document.getElementById('replayCurrentRoute');
const replayRouteList = document.getElementById('replayRouteList');
// New settings
const replaySpeedInput = document.getElementById('replaySpeedInput');
const replaySpeedValue = document.getElementById('replaySpeedValue');
const replayWidthInput = document.getElementById('replayWidthInput');
const replayWidthValue = document.getElementById('replayWidthValue');

function initReplayMap() {
  if (replayMapInstance) return;
  const isDark = document.body.classList.contains('dark');
  const replayMapDiv = document.getElementById('replayMap');

  if (currentMapType === 'amap') {
    replayMapInstance = new AMap.Map('replayMap', { viewMode: '2D', zoom: 4, center: [105, 35] });
    try { replayMapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE); } catch (e) { }
  } else if (currentMapType === 'google') {
    // Check if Google Maps API is available
    if (!window.google || !window.google.maps) {
      console.warn('谷歌地图API未加载，无法在回放中使用谷歌地图');
      alert('谷歌地图API未加载或API密钥无效。\n回放将使用高德地图代替。');
      // Fallback to AMap
      replayMapInstance = new AMap.Map('replayMap', { viewMode: '2D', zoom: 4, center: [105, 35] });
      try { replayMapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE); } catch (e) { }
    } else {
      const styles = API_CONFIG.getGoogleMapOptions(isDark).styles;
      replayMapInstance = new google.maps.Map(replayMapDiv, { zoom: 4, center: { lat: 35, lng: 105 }, mapTypeId: google.maps.MapTypeId.ROADMAP, styles: styles });
    }
  } else if (currentMapType === 'leaflet') {
    replayMapInstance = L.map('replayMap', {
      center: [35, 105],
      zoom: 4,
      scrollWheelZoom: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(replayMapInstance);

    // Apply dark mode filter if needed
    if (isDark) {
      try { replayMapInstance.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)'; } catch (e) { }
    }
  }
}

function buildReplayYearOptions() {
  if (!replayYearSelect) return;
  const years = [...new Set(records.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort();
  replayYearSelect.innerHTML = '<option value="">全部</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

let replayCumulativeDistance = 0;
let replayCumulativeTime = 0;

function getRawRecords(type) {
  let raw = [];
  if (type === 'train') {
    try {
      raw = JSON.parse(localStorage.getItem('trainRecords')) || [];
      // Tag with entity type for color coding
      raw.forEach(r => r._entityType = 'train');
    } catch (e) { }
  } else if (type === 'plane') {
    try {
      raw = JSON.parse(localStorage.getItem('planeRecords')) || [];
      // Tag with entity type for color coding
      raw.forEach(r => r._entityType = 'plane');
    } catch (e) { }
  } else if (type === 'all') {
    try {
      const t = JSON.parse(localStorage.getItem('trainRecords')) || [];
      const p = JSON.parse(localStorage.getItem('planeRecords')) || [];
      // Tag with entity type
      t.forEach(r => r._entityType = 'train');
      p.forEach(r => r._entityType = 'plane');
      raw = [...t, ...p];
      // 按时间排序
      raw.sort((a, b) => {
        const da = new Date((a.date || '') + ' ' + (a.time || '00:00'));
        const db = new Date((b.date || '') + ' ' + (b.time || '00:00'));
        return da - db;
      });
    } catch (e) { }
  }
  return raw;
}

function collectReplayPaths(year = '') {
  // 获取当前选择的数据源
  const sourceRadio = document.querySelector('input[name="replaySource"]:checked');
  const sourceType = sourceRadio ? sourceRadio.value : 'all';

  const rawRecords = getRawRecords(sourceType);

  // 仅选择已经缓存了 pathWGS 的记录（按年份过滤可选）
  replayRecords = rawRecords.filter(r => Array.isArray(r.pathWGS) && r.pathWGS.length > 1 && (!year || (r.date && r.date.substring(0, 4) === year)));
  replayTotalSpan.textContent = replayRecords.length.toString();
  replayProgressSpan.textContent = '0';
  replayIndex = 0;
  replayCurrentYear = year;

  // 更新提示文本
  const sourceLabel = sourceType === 'train' ? '火车' : (sourceType === 'plane' ? '飞机' : '全部');
  replayYearModeHint.textContent = `来源：${sourceLabel} | 模式：${isSequentialMode ? '逐年' : (year ? '单年 ' + year : '全部')}`;

  replayYearTotal = replayRecords.length;
  replayYearDone = 0;
  replayCumulativeDistance = 0;
  replayCumulativeTime = 0;
  replayYearProgressTotal.textContent = replayYearTotal.toString();
  replayYearProgressCnt.textContent = '0';
  if (replayYearProgressBar) replayYearProgressBar.style.width = '0%';
  if (replayCurrentRouteBox) replayCurrentRouteBox.textContent = '—';
  if (replayRouteList) replayRouteList.innerHTML = '';
}

// 监听数据源切换
document.querySelectorAll('input[name="replaySource"]').forEach(radio => {
  radio.addEventListener('change', () => {
    // 切换源时重置回放
    if (replayTimer) clearInterval(replayTimer);
    replayTimer = null;
    replayPaused = false;
    replayStatusSpan.textContent = '准备就绪';

    // Show/hide color legend based on source
    const legend = document.getElementById('replayColorLegend');
    if (legend) {
      legend.style.display = radio.value === 'all' ? 'block' : 'none';
    }

    // 重置年份选择器（因为不同源的年份范围可能不同）
    // 这里简单处理：重新构建年份选项
    const sourceType = radio.value;
    const raw = getRawRecords(sourceType);
    const years = [...new Set(raw.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort();
    if (replayYearSelect) {
      replayYearSelect.innerHTML = '<option value="">全部</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
      replayYearSelect.value = '';
      replayYearSelect.disabled = true; // 默认切回全部模式
    }

    // 重置模式为全部
    const modeAll = document.querySelector('input[name="replayMode"][value="all"]');
    if (modeAll) modeAll.checked = true;
    isSequentialMode = false;
    sequentialYears = [];

    collectReplayPaths('');
    clearReplayMapOnly();
  });
});



function animatePolyline(polyline, fullPath, onComplete) {
  let pointIndex = 0;
  const totalPoints = fullPath.length;
  // Dynamic speed: ensure at least 30 frames (0.5s) unless very short, max 120 frames (2s)
  // Calculate points per frame
  // Base 60, adjusted by slider (10 to 100). 30 is default.
  // Higher slider = faster = more points per frame.
  // Multiplier: slider / 30.
  let speedVal = 30;
  if (replaySpeedInput) speedVal = parseInt(replaySpeedInput.value, 10) || 30;
  const multiplier = speedVal / 30;
  const pointsPerFrame = Math.max(1, Math.ceil((totalPoints / 60) * multiplier));

  function step() {
    if (replayPaused) {
      // Stop animation loop if paused
      return;
    }
    if (!replayMapInstance) return;

    for (let i = 0; i < pointsPerFrame; i++) {
      if (pointIndex < totalPoints) {
        if (currentMapType === 'amap') {
          const currentPath = polyline.getPath();
          currentPath.push(fullPath[pointIndex]);
          polyline.setPath(currentPath);
        } else if (currentMapType === 'google') {
          const currentPath = polyline.getPath();
          currentPath.push(fullPath[pointIndex]);
        } else if (currentMapType === 'leaflet') {
          const currentPath = polyline.getLatLngs();
          currentPath.push(fullPath[pointIndex]);
          polyline.setLatLngs(currentPath);
        }
        pointIndex++;
      }
    }

    if (pointIndex < totalPoints) {
      replayAnimationId = requestAnimationFrame(step);
    } else {
      onComplete && onComplete();
    }
  }
  step();
}

function drawReplayOne() {
  if (replayPaused) return; // Should not happen if logic checks pause before calling

  if (replayIndex >= replayRecords.length) {
    replayStatusSpan.textContent = '完成';
    replayTimer = null; // Mark as done
    // 如果是逐年模式，进入下一年
    if (isSequentialMode) {
      setTimeout(() => proceedNextSequentialYear(), 500);
    }
    return;
  }
  const rec = replayRecords[replayIndex];
  const year = rec.date ? rec.date.substring(0, 4) : '';

  // Determine color based on source type
  const sourceRadio = document.querySelector('input[name="replaySource"]:checked');
  const sourceType = sourceRadio ? sourceRadio.value : 'all';
  let strokeColor;

  if (sourceType === 'all') {
    // In 'all' mode, use entity-based colors: red for train, blue for plane
    strokeColor = rec._entityType === 'plane' ? '#2196F3' : '#F44336'; // Blue for plane, Red for train
  } else {
    // In single entity mode, use year-based colors
    strokeColor = getYearColor(year);
  }

  // 累加数据
  replayCumulativeDistance += (rec.distance || 0);
  replayCumulativeTime += parseDurationToMinutes(rec.duration);

  // 显示累计数据
  if (replayCurrentRouteBox) {
    let distStr = '';
    if (replayCumulativeDistance >= 10000) {
      distStr = (replayCumulativeDistance / 10000).toFixed(2) + ' 万公里';
    } else {
      distStr = Math.round(replayCumulativeDistance).toLocaleString() + ' 公里';
    }
    const timeStr = formatMinutesToDuration(replayCumulativeTime);
    replayCurrentRouteBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; margin-bottom:2px;">
        <span>总里程:</span> <span style="font-weight:bold; color:var(--primary-color);">${distStr}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>总时长:</span> <span style="font-weight:bold; color:var(--primary-color);">${timeStr}</span>
      </div>
    `;
  }
  if (replayRouteList) {
    const li = document.createElement('li');
    li.style.padding = '2px 4px';
    li.style.border = '1px solid var(--border-color)';
    li.style.borderRadius = '4px';
    li.style.background = 'var(--input-bg)';
    li.style.cursor = 'pointer';
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '6px';
    const startLabel = (rec.startCity || rec.startStation || '?');
    const endLabel = (rec.endCity || rec.endStation || '?');
    li.textContent = `${startLabel} → ${endLabel}` + (rec.distance ? ` (${rec.distance}km)` : '');
    // 高亮当前
    replayRouteList.querySelectorAll('li').forEach(n => n.style.outline = 'none');
    li.style.outline = '2px solid var(--primary-color)';
    // 点击聚焦（平移中心）
    li.addEventListener('click', () => {
      try {
        if (!rec.pathWGS || !rec.pathWGS.length) return;
        const mid = rec.pathWGS[Math.floor(rec.pathWGS.length / 2)];
        if (currentMapType === 'amap' && replayMapInstance) {
          replayMapInstance.setZoomAndCenter(6, [mid[0], mid[1]]);
        } else if (currentMapType === 'google' && replayMapInstance) {
          replayMapInstance.setZoom(6);
          replayMapInstance.setCenter({ lat: mid[1], lng: mid[0] });
        } else if (currentMapType === 'leaflet' && replayMapInstance) {
          replayMapInstance.setView([mid[1], mid[0]], 6);
        }
      } catch (e) { }
    });
    replayRouteList.appendChild(li);
    // 滚动到底部
    replayRouteList.parentElement.scrollTop = replayRouteList.parentElement.scrollHeight;
  }

  // Cleanup partial polyline if re-entering same index (e.g. restart after pause)
  if (replayPolylines[replayIndex]) {
    if (currentMapType === 'amap') replayPolylines[replayIndex].setMap(null);
    else if (currentMapType === 'google') replayPolylines[replayIndex].setMap(null);
    else if (currentMapType === 'leaflet' && replayMapInstance) replayPolylines[replayIndex].remove();
    replayPolylines[replayIndex] = null;
  }

  try {
    let lineWidth = 1;
    if (replayWidthInput) lineWidth = parseFloat(replayWidthInput.value) || 1;

    let polyline = null;
    let fullPath = [];

    if (currentMapType === 'amap') {
      let gcjPath = rec.pathGCJ;
      if (!gcjPath || !gcjPath.length) {
        gcjPath = rec.pathWGS.map(p => isInChina(p[0], p[1]) ? wgs84ToGcj02(p[0], p[1]) : p);
      }
      fullPath = gcjPath;
      // Start with empty path
      polyline = new AMap.Polyline({ path: [], strokeColor, strokeWeight: lineWidth, strokeOpacity: 0.9 });
      replayMapInstance.add(polyline);
      // Ensure we fill the array slot correctly
      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;

    } else if (currentMapType === 'google') {
      const googlePath = rec.pathWGS.map(p => ({ lat: p[1], lng: p[0] }));
      fullPath = googlePath;
      // Start with empty path
      polyline = new google.maps.Polyline({ path: [], geodesic: false, strokeColor, strokeOpacity: 0.9, strokeWeight: lineWidth });
      polyline.setMap(replayMapInstance);

      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;
    } else if (currentMapType === 'leaflet') {
      const leafletPath = rec.pathWGS.map(p => [p[1], p[0]]);
      fullPath = leafletPath;
      // Start with empty path
      polyline = L.polyline([], {
        color: strokeColor,
        weight: lineWidth,
        opacity: 0.9
      }).addTo(replayMapInstance);

      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;
    }

    if (polyline && fullPath.length) {
      animatePolyline(polyline, fullPath, () => {
        // Animation Complete
        replayIndex++;
        // Update Progress
        replayProgressSpan.textContent = replayIndex.toString();
        // Update Status
        replayStatusSpan.textContent = `绘制中 (${replayIndex}/${replayRecords.length})`;
        if (replayIndex === replayRecords.length) {
          replayStatusSpan.textContent = '完成';
        }
        // Update Year Progress
        replayYearDone++;
        if (replayYearProgressCnt) replayYearProgressCnt.textContent = replayYearDone.toString();
        if (replayYearProgressBar) {
          const pct = replayYearTotal ? (replayYearDone / replayYearTotal * 100) : 0;
          replayYearProgressBar.style.width = pct.toFixed(2) + '%';
        }

        // Trigger next
        drawReplayOne();
      });

      // Update initial status
      replayStatusSpan.textContent = `绘制中 (${replayIndex + 1}/${replayRecords.length})`;
    } else {
      // Fallback if no path
      replayIndex++;
      drawReplayOne();
    }

  } catch (e) {
    console.warn('回放绘制失败', e.message);
    replayIndex++;
    drawReplayOne();
  }
}

function startReplay() {
  if (!replayRecords.length) {
    replayStatusSpan.textContent = '无可回放线路';
    return;
  }
  replayPaused = false;
  replayStatusSpan.textContent = '绘制中';
  // Use a dummy timer flag so other logic thinks it's running? 
  // Existing logic checks if (replayTimer) clearInterval...
  // Let's keep replayTimer as a simple boolean flag or just not null
  if (replayTimer) clearInterval(replayTimer); // just in case
  replayTimer = 1; // Mark as running

  drawReplayOne();
}

// Store replay polylines for cleanup
let replayPolylines = [];

function clearReplayMapOnly() {
  try {
    // Cancel any ongoing animation
    if (replayAnimationId) {
      cancelAnimationFrame(replayAnimationId);
      replayAnimationId = null;
    }

    if (currentMapType === 'amap' && replayMapInstance) {
      // Clear all overlays without recreating the map to avoid flashing
      replayMapInstance.clearMap();
      replayPolylines = [];
    } else if (currentMapType === 'google' && replayMapInstance) {
      // Remove only the polylines, not the entire map
      replayPolylines.forEach(polyline => {
        if (polyline && polyline.setMap) polyline.setMap(null);
      });
      replayPolylines = [];
    } else if (currentMapType === 'leaflet' && replayMapInstance) {
      // Remove only the polylines
      replayPolylines.forEach(polyline => {
        if (polyline && polyline.remove) polyline.remove();
      });
      replayPolylines = [];
    }
  } catch (e) {
    console.warn('清除回放地图失败:', e);
  }
}

function proceedNextSequentialYear() {
  if (!isSequentialMode) return;
  if (sequentialPointer >= sequentialYears.length) {
    replayStatusSpan.textContent = '逐年播放完成';
    isSequentialMode = false;
    return;
  }
  const year = sequentialYears[sequentialPointer++];
  clearReplayMapOnly();
  if (replayRouteList) replayRouteList.innerHTML = '';
  collectReplayPaths(year);
  replayStatusSpan.textContent = `年份 ${year} 开始`;
  startReplay();
}

if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    // 动画回放不需要二次确认，直接打开
    replayOverlay.style.display = 'flex';
    replayStatusSpan.textContent = '准备就绪';

    // 销毁旧地图实例，重新加载以匹配当前地图类型
    if (replayMapInstance) {
      try {
        if (currentMapType === 'amap' && replayMapInstance.destroy) {
          replayMapInstance.destroy();
        } else if (currentMapType === 'google') {
          document.getElementById('replayMap').innerHTML = '';
        } else if (currentMapType === 'leaflet' && replayMapInstance.remove) {
          replayMapInstance.remove();
        }
      } catch (e) {
        console.warn('销毁回放地图失败:', e);
      }
      replayMapInstance = null;
    }

    initReplayMap();
    buildReplayYearOptions();

    // 初始化数据源选择：默认选中当前实体，或者全部
    // 这里默认选中当前实体，方便用户查看当前上下文
    const sourceRadios = document.querySelectorAll('input[name="replaySource"]');
    sourceRadios.forEach(r => {
      if (r.value === currentEntity) r.checked = true;
    });

    // 初始化默认模式：全部年份播放
    const modeAllRadio = document.querySelector('input[name="replayMode"][value="all"]');
    if (modeAllRadio) modeAllRadio.checked = true;
    if (replayYearSelect) { replayYearSelect.disabled = true; replayYearSelect.value = ''; }
    isSequentialMode = false; sequentialYears = []; sequentialPointer = 0; replayCurrentYear = '';

    // 触发一次收集以更新界面
    collectReplayPaths('');

    // Initialize legend visibility
    const legend = document.getElementById('replayColorLegend');
    if (legend) {
      legend.style.display = currentEntity === 'all' ? 'block' : 'none';
    }
    // 绑定键盘快捷键
    const keyHandler = (e) => {
      if (replayOverlay.style.display !== 'flex') return;
      if (e.key === 'Escape') { replayCloseBtn.click(); }
      if (e.code === 'Space') { e.preventDefault(); replayPauseBtn && replayPauseBtn.click(); }
    };
    window._replayKeyHandler = keyHandler;
    window.addEventListener('keydown', keyHandler);
  });
}
if (replayCloseBtn) {
  replayCloseBtn.addEventListener('click', () => {
    replayOverlay.style.display = 'none';
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    // 移除快捷键
    if (window._replayKeyHandler) {
      window.removeEventListener('keydown', window._replayKeyHandler);
      delete window._replayKeyHandler;
    }

    // 自动重置回放状态
    if (replayResetBtn) {
      replayResetBtn.click();
    }
  });
}
if (replayStartBtn) {
  replayStartBtn.addEventListener('click', () => {
    // 如果当前已经在播放则忽略
    if (replayTimer && !replayPaused) return;

    // Clear existing polylines without recreating the map
    clearReplayMapOnly();

    // 重新开始：依据当前模式重置
    const mode = document.querySelector('input[name="replayMode"]:checked')?.value || 'all';

    if (mode === 'sequential') {
      const sourceRadio = document.querySelector('input[name="replaySource"]:checked');
      const sourceType = sourceRadio ? sourceRadio.value : 'all';
      const rawRecords = getRawRecords(sourceType);
      const years = [...new Set(rawRecords.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort();
      if (!years.length) { replayStatusSpan.textContent = '无年份数据'; return; }
      isSequentialMode = true;
      sequentialYears = years;
      sequentialPointer = 0;
      replayStatusSpan.textContent = '逐年播放启动';
      proceedNextSequentialYear();
    } else if (mode === 'single') {
      isSequentialMode = false;
      const y = replayYearSelect.value;
      collectReplayPaths(y);
      startReplay();
    } else { // all
      isSequentialMode = false;
      collectReplayPaths('');
      startReplay();
    }
  });
}
if (replayPauseBtn) {
  replayPauseBtn.addEventListener('click', () => {
    if (!replayTimer) { // 若还未开始，触发开始
      replayStartBtn.click();
      return;
    }
    replayPaused = !replayPaused;
    replayPauseBtn.textContent = replayPaused ? '继续' : '暂停';
    replayStatusSpan.textContent = replayPaused ? '已暂停' : `绘制中 (${replayIndex}/${replayRecords.length})`;

    if (!replayPaused) {
      // Resume playback logic
      // Restart drawing the current one (it will clean itself up)
      drawReplayOne();
    }
  });
}
if (replayResetBtn) {
  replayResetBtn.addEventListener('click', () => {
    // 重置到初始化状态（保持当前模式单选选项 & 年份选择启用状态）
    replayPaused = false;
    if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
    clearReplayMapOnly();
    const mode = document.querySelector('input[name="replayMode"]:checked')?.value || 'all';
    if (mode === 'sequential') {
      isSequentialMode = false; sequentialYears = []; sequentialPointer = 0; // 等待重新开始点击
      replayStatusSpan.textContent = '逐年模式待开始';
      collectReplayPaths('');
    } else if (mode === 'single') {
      collectReplayPaths(replayYearSelect.value || '');
      replayStatusSpan.textContent = '单年待开始';
    } else {
      collectReplayPaths('');
      replayStatusSpan.textContent = '全部年份待开始';
    }
    replayPauseBtn.textContent = '暂停';
  });
}

// 年份选择单年播放
if (replayYearSelect) {
  replayYearSelect.addEventListener('change', () => {
    isSequentialMode = false;
    sequentialYears = [];
    sequentialPointer = 0;
    clearReplayMapOnly();
    collectReplayPaths(replayYearSelect.value);
    if (replayRecords.length) {
      replayStatusSpan.textContent = `年份 ${replayYearSelect.value || '全部'} 准备`;
      startReplay();
    } else {
      replayStatusSpan.textContent = '所选年份无线路';
    }
  });
}

// 逐年播放按钮逻辑
// 播放模式变更
replayModeRadios.forEach(r => {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    const mode = r.value;
    isSequentialMode = false;
    sequentialYears = [];
    sequentialPointer = 0;
    if (mode === 'single') {
      replayYearSelect.disabled = false;
      replayYearModeHint.textContent = '单一年份';
      if (replayYearSelect.value) {
        clearReplayMapOnly();
        collectReplayPaths(replayYearSelect.value);
        startReplay();
      }
    } else if (mode === 'sequential') {
      replayYearSelect.disabled = true;
      replayYearModeHint.textContent = '逐年';
      // 准备逐年但不立即开始，等待点击“重新开始”或用户再手动触发开始按钮
    } else { // all
      replayYearSelect.disabled = true;
      replayYearModeHint.textContent = '全部年份';
      clearReplayMapOnly();
      collectReplayPaths('');
      startReplay();
    }
  });
});

if (replayYearSelect) {
  replayYearSelect.addEventListener('change', () => {
    const modeRadio = document.querySelector('input[name="replayMode"][value="single"]');
    if (modeRadio && modeRadio.checked) {
      clearReplayMapOnly();
      collectReplayPaths(replayYearSelect.value);
      startReplay();
    }
  });
}

// Settings Listeners
if (replaySpeedInput && replaySpeedValue) {
  replaySpeedInput.addEventListener('input', () => {
    let val = parseInt(replaySpeedInput.value, 10);
    // Display as x1.0, x0.5 etc.
    let ratio = (val / 30).toFixed(1);
    replaySpeedValue.textContent = 'x' + ratio;
  });
}
if (replayWidthInput && replayWidthValue) {
  replayWidthInput.addEventListener('input', () => {
    let val = parseFloat(replayWidthInput.value);
    replayWidthValue.textContent = val + 'px';
  });
}

// 线路错误展示逻辑
const pathErrorBox = document.getElementById('pathErrorBox');
const pathErrorList = document.getElementById('pathErrorList');
const clearPathErrorsBtn = document.getElementById('clearPathErrorsBtn');

function addPathErrorUI(rec, msg) {
  if (!pathErrorBox || !pathErrorList) return;
  const li = document.createElement('li');
  const startLabel = (rec.startCity || '') + (rec.startStation || '');
  const endLabel = (rec.endCity || '') + (rec.endStation || '');
  li.textContent = `${startLabel} → ${endLabel}: ${msg}`;
  pathErrorList.appendChild(li);
  pathErrorBox.style.display = 'block';
}
window.addPathErrorUI = addPathErrorUI;
if (clearPathErrorsBtn) {
  clearPathErrorsBtn.addEventListener('click', () => {
    pathErrorList.innerHTML = '';
    pathErrorBox.style.display = 'none';
    // 清除记录中的标记
    records.forEach(r => { delete r._pathError; });
  });
}

// 数据备份事件监听
backupBtn.addEventListener('click', () => confirmRun('备份包含：记录(含已缓存路径) + 地理编码缓存 + 主题 + 地图类型 + 年份选择 + 当前模式\n生成 JSON 文件，继续？', backupData));

// 数据恢复事件监听
restoreBtn.addEventListener('click', () => {
  confirmRun('确定恢复数据？这会覆盖当前所有记录与设置！', () => restoreFile.click());
});

restoreFile.addEventListener('change', e => {
  if (e.target.files.length > 0) {
    restoreData(e.target.files[0]);
    e.target.value = ''; // 重置文件选择器
  }
});

// 功能说明弹窗
if (featuresHelpBtn && featuresHelpOverlay && featuresHelpClose) {
  featuresHelpBtn.addEventListener('click', () => {
    featuresHelpOverlay.style.display = 'flex';
  });
  featuresHelpClose.addEventListener('click', () => {
    featuresHelpOverlay.style.display = 'none';
  });
  featuresHelpOverlay.addEventListener('click', (e) => {
    if (e.target === featuresHelpOverlay) {
      featuresHelpOverlay.style.display = 'none';
    }
  });
  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && featuresHelpOverlay.style.display === 'flex') {
      featuresHelpOverlay.style.display = 'none';
    }
  });
}

// Main form submission logic（行内模式下可能无此按钮）
if (addBtn) addBtn.addEventListener('click', () => {
  const recordData = {
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    duration: document.getElementById('duration').value,
    trainNo: document.getElementById('trainNo').value.trim(),
    startStation: document.getElementById('startStation').value.trim(),
    startCity: startCityInput.value.trim(),
    endStation: document.getElementById('endStation').value.trim(),
    endCity: endCityInput.value.trim(),
    seatClass: document.getElementById('seatClass').value.trim(),
    trainType: document.getElementById('trainType').value.trim(),
    bureau: document.getElementById('bureau').value.trim(),
    cost: parseFloat(costInput.value) || 0,
    distance: parseFloat(distanceInput.value) || 0,
    notes: document.getElementById('notes').value.trim()
  };

  if (!recordData.startStation || !recordData.endStation) {
    const cfg = getEntityConfig();
    alert(`${cfg.labels.startStation} 和 ${cfg.labels.endStation} 不能为空！`);
    return;
  }

  let newRow;
  if (currentMode === 'modify' && insertionTarget) {
    // 修改模式：删除原行，在相同位置插入新行
    insertionTarget._overlays?.forEach(o => o.setMap(null));
    const insertBefore = insertionTarget.nextSibling;
    insertionTarget.remove();
    newRow = addRecordToTable(recordData);
    if (insertBefore) {
      tbody.insertBefore(newRow, insertBefore);
    } else {
      tbody.appendChild(newRow);
    }
  } else if (currentMode === 'insert' && insertionTarget) {
    // 插入模式：在指定行后插入
    newRow = addRecordToTable(recordData, insertionTarget);
  } else { // 'add' mode
    // 添加模式：添加到末尾
    newRow = addRecordToTable(recordData);
  }

  updateSequenceNumbers();
  syncRecordsFromTable(); // 修复：确保数据同步到records数组并保存
  clearForm();
  setMode('add');
});

// 新增：表格末尾新增一行（行内编辑）
const addRowBtn = document.getElementById('addRowBtn');
if (addRowBtn) {
  addRowBtn.addEventListener('click', () => {
    createInlineNewRow();
  });
}

function createInlineNewRow() {
  const lastTr = tbody.lastElementChild;
  if (lastTr) {
    insertInlineAfter(lastTr);
  } else {
    // 表格为空时，创建第一行
    const newTr = document.createElement('tr');
    const cfg = getEntityConfig();
    newTr.innerHTML = `
          <td></td>
          <td><input class=\"inline-input\" type=\"date\" placeholder=\"日期\" title=\"日期\"></td>
          <td><input class=\"inline-input\" type=\"time\" placeholder=\"时间\" title=\"时间\"></td>
          <td>${buildDurationSelects('00:00')}</td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainNo}\" title=\"${cfg.labels.trainNo}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startStation}\" title=\"${cfg.labels.startStation}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.startCity}\" title=\"${cfg.labels.startCity}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endStation}\" title=\"${cfg.labels.endStation}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.endCity}\" title=\"${cfg.labels.endCity}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.seatClass}\" title=\"${cfg.labels.seatClass}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.trainType}\" title=\"${cfg.labels.trainType}\"></td>
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"${cfg.labels.bureau}\" title=\"${cfg.labels.bureau}\"></td>
          <td><input class=\"inline-input\" type=\"number\" step=\"0.01\" placeholder=\"费用 (RMB)\" title=\"费用 (RMB)\" value=\"0\"></td>
          <td><input class=\"inline-input\" type=\"number\" step=\"1\" placeholder=\"里程 (km)\" title=\"里程 (km)\" value=\"0\"></td>
          <td></td><!-- RMB/km -->
          <td></td><!-- Speed -->
          <td><input class=\"inline-input\" type=\"text\" placeholder=\"备注\" title=\"备注\"></td>
          <td>
            <button class=\"save\">保存</button>
            <button class=\"cancel\">取消</button>
          </td>
        `;
    tbody.appendChild(newTr);
    newTr._isNewRow = true;
    updateSequenceNumbers();

    const c = newTr.cells;
    const updateRowRpk = () => {
      const cost = parseFloat(c[COL.cost].querySelector('input').value) || 0;
      const dist = parseFloat(c[COL.distance].querySelector('input').value) || 0;
      c[COL.rmbPerKm].textContent = dist > 0 ? (cost / dist).toFixed(4) : '';
    };
    c[COL.cost].querySelector('input').addEventListener('input', updateRowRpk);
    c[COL.distance].querySelector('input').addEventListener('input', updateRowRpk);

    c[COL.actions].querySelector('.save').addEventListener('click', () => {
      const rec = collectRowData(newTr);
      if (!rec.startStation || !rec.endStation) {
        const cfg = getEntityConfig();
        alert(`${cfg.labels.startStation} 和 ${cfg.labels.endStation} 不能为空！`);
        return;
      }
      renderRowFromData(newTr, rec);
      updateSequenceNumbers();
      // 追加到 records 尾部（不重建其它记录，避免丢失路径缓存）
      records.push({ ...rec });
      saveRecords();
      // 仅绘制新增线路
      try { drawPath(newTr, records[records.length - 1]); } catch (e) { console.warn('绘制新增线路失败', e); }
      try { updateYearLegend && updateYearLegend(); } catch { }
      try { updateStats && updateStats(); } catch { }
    });

    c[COL.actions].querySelector('.cancel').addEventListener('click', () => {
      newTr.remove();
      updateSequenceNumbers();
    });
  }
}

// 新增：CSV导入功能
function importCsv(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const csvText = e.target.result;
      const lines = csvText.split('\n');

      if (lines.length <= 1) {
        throw new Error('CSV文件无数据或格式错误');
      }

      // 解析CSV头部
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log('CSV表头:', headers);

      // 解析CSV数据
      const csvData = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCsvLine(line);
        if (values.length === headers.length) {
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header] = values[index];
          });
          csvData.push(rowData);
        }
      }

      console.log('CSV数据预览:', csvData);

      // 解析CSV数据为应用格式
      const newRecords = parseCsvToRecords(csvData);

      if (newRecords.length === 0) {
        throw new Error('无法解析CSV数据，请检查文件格式');
      }

      // 询问用户如何处理数据
      const replace = confirm(
        `成功解析 ${newRecords.length} 条记录\n\n` +
        `点击"确定"替换所有现有数据\n` +
        `点击"取消"添加到现有数据`
      );

      if (replace) {
        records = newRecords;
      } else {
        records = [...records, ...newRecords];
      }

      saveRecords();
      alert(`${replace ? '替换' : '添加'}了 ${newRecords.length} 条记录，页面将重新加载`);
      location.reload();

    } catch (error) {
      console.error('CSV导入失败:', error);
      alert('CSV导入失败: ' + error.message);
    }
  };

  reader.onerror = function () {
    alert('读取CSV文件失败');
  };

  reader.readAsText(file, 'UTF-8');
}

// 解析CSV行，处理引号包围的字段
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

// 解析CSV数据为记录格式
function parseCsvToRecords(csvData) {
  const newRecords = [];

  // 字段映射
  const cfg = getEntityConfig();
  const fieldMap = {
    seq: '序号',
    date: '时间',
    time: '时刻',
    duration: '时长',
    trainNo: cfg.labels.trainNo,
    startStation: cfg.labels.startStation,
    startCity: cfg.labels.startCity,
    endStation: cfg.labels.endStation,
    endCity: cfg.labels.endCity,
    seatClass: cfg.labels.seatClass,
    trainType: cfg.labels.trainType,
    bureau: cfg.labels.bureau,
    cost: '费用(RMB)',
    distance: '里程(km)',
    pricePerKm: 'RMB/km',
    notes: '备注'
  };

  for (const row of csvData) {
    try {
      // 处理日期格式
      let date = '';
      if (row[fieldMap.date]) {
        const dateStr = String(row[fieldMap.date]);
        const match = dateStr.match(/(\d{4})[\.\-\/]?(\d{1,2})[\.\-\/]?(\d{1,2})/);
        if (match) {
          const [, y, m, d] = match;
          date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
      }

      // 处理时间格式
      let time = '';
      if (row[fieldMap.time]) {
        const timeStr = String(row[fieldMap.time]).trim();
        const match = timeStr.match(/(\d{1,2})[\：\:\.]\s*(\d{1,2})/);
        if (match) {
          const [, h, m] = match;
          time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        }
      }

      // 处理时长格式
      let duration = '';
      if (row[fieldMap.duration]) {
        const durationStr = String(row[fieldMap.duration]);
        const match = durationStr.match(/(\d{1,2})[\：\:](\d{1,2})/);
        if (match) {
          const [, h, m] = match;
          duration = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
        }
      }

      const record = {
        date: date,
        time: time,
        duration: duration,
        trainNo: String(row[fieldMap.trainNo] || ''),
        startStation: String(row[fieldMap.startStation] || ''),
        startCity: String(row[fieldMap.startCity] || ''),
        endStation: String(row[fieldMap.endStation] || ''),
        endCity: String(row[fieldMap.endCity] || ''),
        seatClass: String(row[fieldMap.seatClass] || ''),
        trainType: String(row[fieldMap.trainType] || ''),
        bureau: String(row[fieldMap.bureau] || ''),
        cost: parseFloat(row[fieldMap.cost]) || 0,
        distance: parseFloat(row[fieldMap.distance]) || 0,
        notes: String(row[fieldMap.notes] || '')
      };

      // 验证必要字段
      if (!record.startStation || !record.endStation) {
        console.warn('跳过无效行，缺少起点或终点:', row);
        continue;
      }

      newRecords.push(record);

    } catch (error) {
      console.warn('解析CSV行数据失败:', row, error);
    }
  }

  return newRecords;
}

// CSV导入事件监听
document.getElementById('importCsvBtn').addEventListener('click', () => {
  document.getElementById('importCsvFile').click();
});

document.getElementById('importCsvFile').addEventListener('change', e => {
  if (e.target.files.length > 0) {
    importCsv(e.target.files[0]);
    e.target.value = ''; // 重置文件选择器
  }
});

// 新增：CSV导出功能
function exportToCsv() {
  try {
    if (records.length === 0) {
      alert('没有数据可以导出！');
      return;
    }

    // CSV表头
    const cfg = getEntityConfig();
    const headers = [
      '序号', '时间', '时刻', '时长', cfg.labels.trainNo, cfg.labels.startStation, cfg.labels.startCity,
      cfg.labels.endStation, cfg.labels.endCity, cfg.labels.seatClass, cfg.labels.trainType, cfg.labels.bureau,
      '费用(RMB)', '里程(km)', 'RMB/km', 'km/h', '备注'
    ];

    // 构建CSV内容
    const csvContent = [];

    // 添加表头
    csvContent.push(headers.join(','));

    // 添加数据行
    records.forEach((record, index) => {
      const pricePerKm = record.distance > 0 ? (record.cost / record.distance).toFixed(4) : '';

      // Calculate Speed
      let speed = '';
      const durationMins = parseDurationToMinutes(record.duration);
      if (record.distance > 0 && durationMins > 0) {
        speed = (record.distance / (durationMins / 60)).toFixed(1);
      }

      const row = [
        index + 1, // 序号
        record.date || '',
        record.time || '',
        record.duration || '',
        record.trainNo || '',
        record.startStation || '',
        record.startCity || '',
        record.endStation || '',
        record.endCity || '',
        record.seatClass || '',
        record.trainType || '',
        record.bureau || '',
        (record.cost || 0).toFixed(2),
        record.distance || 0,
        pricePerKm,
        speed,
        record.notes || ''
      ];

      // 处理包含逗号的字段，用引号包围
      const escapedRow = row.map(field => {
        const fieldStr = String(field);
        if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
          return '"' + fieldStr.replace(/"/g, '""') + '"';
        }
        return fieldStr;
      });

      csvContent.push(escapedRow.join(','));
    });

    // 创建Blob对象
    const csvString = csvContent.join('\n');
    const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });

    // 创建下载链接
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    // 生成文件名（包含当前日期）
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    link.setAttribute('download', `${cfg.exportPrefix}_${dateStr}.csv`);

    // 触发下载
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`成功导出 ${records.length} 条记录到CSV文件！`);

  } catch (error) {
    console.error('CSV导出失败:', error);
    alert('CSV导出失败: ' + error.message);
  }
}

// Excel导入功能
function importExcel(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length < 2) {
        alert('Excel文件格式不正确或没有数据');
        return;
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1);

      // 字段映射（支持中英文表头，兼容火车/飞机）
      const fieldMap = {
        date: ['日期', 'Date'],
        time: ['时间', 'Time', '发车时间', '起飞时间', 'Departure Time'],
        duration: ['时长', 'Duration', '历时', '飞行时长'],
        trainNo: ['车次', 'Train No', '列车车次', '航班号', 'Flight No'],
        startStation: ['起点站', 'Start Station', '出发站', '出发机场', 'Departure Airport'],
        startCity: ['起点城市', 'Start City', '出发城市'],
        endStation: ['终点站', 'End Station', '到达站', '到达机场', 'Arrival Airport'],
        endCity: ['终点城市', 'End City', '到达城市'],
        seatClass: ['坐席', 'Seat Class', '席别', '舱位', 'Cabin'],
        trainType: ['车型号', 'Train Type', '列车等级', '航空公司', 'Airline'],
        bureau: ['铁路局', 'Bureau', '担当局', '承运人代码', 'Carrier Code', '机型', 'Aircraft', 'Aircraft Type', 'Plane Model'],
        cost: ['费用', 'Cost', '票价', '费用(RMB)'],
        distance: ['里程', 'Distance', '里程(km)'],
        notes: ['备注', 'Notes']
      };

      // 找到列对应关系
      const columnMap = {};
      headers.forEach((header, index) => {
        for (const [field, possibleNames] of Object.entries(fieldMap)) {
          if (possibleNames.some(name => header.includes(name))) {
            columnMap[field] = index;
            break;
          }
        }
      });

      let importCount = 0;
      rows.forEach(row => {
        if (row.length === 0 || !row.some(cell => cell)) return; // 跳过空行

        const recordData = {};

        // 提取数据
        for (const [field, columnIndex] of Object.entries(columnMap)) {
          if (columnIndex !== undefined && row[columnIndex] !== undefined) {
            recordData[field] = String(row[columnIndex]).trim();
          }
        }

        // 处理日期格式
        if (recordData.date) {
          const dateStr = String(recordData.date);
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              recordData.date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }
        }

        // 处理数值字段
        ['cost', 'distance'].forEach(field => {
          if (recordData[field]) {
            const num = parseFloat(recordData[field]);
            if (!isNaN(num)) {
              recordData[field] = num;
            }
          }
        });

        if (recordData.date || recordData.trainNo) {
          addRecordToTable(recordData);
          importCount++;
        }
      });

      if (importCount > 0) {
        updateSequenceNumbers();
        // 将表格数据同步到 records 并保存到当前模式的存储键
        syncRecordsFromTable();
        updateYearLegend();
        updateStats();
        redrawAllPaths();
        alert(`成功从Excel导入 ${importCount} 条记录！`);
      } else {
        alert('Excel文件中没有找到有效的记录数据');
      }

    } catch (error) {
      console.error('Excel导入失败:', error);
      alert('Excel导入失败: ' + error.message);
    }
  };

  reader.onerror = function () {
    alert('读取Excel文件失败');
  };

  reader.readAsArrayBuffer(file);
}

// JSON导出功能
function exportToJson() {
  try {
    const cfg = getEntityConfig();
    const data = {
      exportDate: new Date().toISOString(),
      version: '8.0',
      recordCount: records.length,
      records: records.map((record, index) => {
        let speed = '';
        const durationMins = parseDurationToMinutes(record.duration);
        if (record.distance > 0 && durationMins > 0) {
          speed = (record.distance / (durationMins / 60)).toFixed(1);
        }
        return {
          id: index + 1,
          ...record,
          pricePerKm: record.distance > 0 ? (record.cost / record.distance).toFixed(4) : '',
          speed: speed
        };
      })
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    link.setAttribute('download', `${cfg.exportPrefix}_${dateStr}.json`);

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`成功导出 ${records.length} 条记录到JSON文件！`);

  } catch (error) {
    console.error('JSON导出失败:', error);
    alert('JSON导出失败: ' + error.message);
  }
}

// 数据备份功能
function backupData() {
  try {
    const cfg = getEntityConfig();
    const backupData = {
      backupDate: new Date().toISOString(),
      version: '8.0',
      recordCount: records.length,
      records: records, // 已包含每条的 pathWGS/pathGCJ（若已绘制）
      geocodeCache: geocodeCache, // 额外：地理编码缓存，便于换浏览器无需重新请求
      settings: {
        currentMapType: currentMapType,
        selectedYears: Array.from(selectedYears),
        theme: document.body.classList.contains('dark') ? 'dark' : 'light',
        entity: currentEntity
      }
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/:/g, '-');
    link.setAttribute('download', `${cfg.backupPrefix}_${dateStr}.json`);

    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    alert(`成功备份 ${records.length} 条记录和设置！`);

  } catch (error) {
    console.error('数据备份失败:', error);
    alert('数据备份失败: ' + error.message);
  }
}

// 数据恢复功能
function restoreData(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const backupData = JSON.parse(e.target.result);
      const ver = backupData.version || '1.0';

      if (!backupData.records || !Array.isArray(backupData.records)) {
        alert('备份文件格式不正确');
        return;
      }

      if (records.length > 0) {
        if (!confirm(`当前有 ${records.length} 条记录，恢复备份将覆盖现有数据。是否继续？`)) {
          return;
        }
      }

      // 清空现有数据
      records.length = 0;
      tbody.innerHTML = '';

      // 恢复记录数据（包含已缓存的路径坐标）
      backupData.records.forEach(record => {
        // 兼容旧版本：可能没有 pathWGS/pathGCJ
        if (record.pathWGS && !Array.isArray(record.pathWGS)) delete record.pathWGS;
        if (record.pathGCJ && !Array.isArray(record.pathGCJ)) delete record.pathGCJ;
        addRecordToTable(record);
      });

      // 恢复地理编码缓存（1.1+）
      if (ver >= '1.1' && backupData.geocodeCache && typeof backupData.geocodeCache === 'object') {
        geocodeCache = backupData.geocodeCache;
        saveGeocodeCache();
        console.log(`已恢复地理编码缓存：${Object.keys(geocodeCache).length} 项 (v${ver})`);
      } else if (!backupData.geocodeCache) {
        console.log(`备份版本 ${ver} 未包含地理编码缓存字段，恢复后首次需要路径可能重新请求。`);
      }

      // 恢复设置
      if (backupData.settings) {
        const settings = backupData.settings;

        // 恢复主题
        if (settings.theme === 'dark' && !document.body.classList.contains('dark')) {
          document.body.classList.add('dark');
          themeToggle.textContent = '☀️ 切换到亮色';
        } else if (settings.theme === 'light' && document.body.classList.contains('dark')) {
          document.body.classList.remove('dark');
          themeToggle.textContent = '🌙 切换到暗色';
        }

        // 恢复选中年份
        if (settings.selectedYears) {
          selectedYears.clear();
          settings.selectedYears.forEach(year => selectedYears.add(year));
        }

        // 地点标记显示状态已废弃

        // 恢复实体（火车/飞机）
        if (settings.entity === 'plane' || settings.entity === 'train') {
          currentEntity = settings.entity;
          localStorage.setItem('entity', currentEntity);
          applyEntityUI(currentEntity);
        }
      }

      // 将表格数据同步到 records 并保存到当前模式的存储键
      syncRecordsFromTable();

      // 更新界面
      updateSequenceNumbers();
      updateYearLegend();
      updateStats();
      redrawAllPaths();

      alert(`成功恢复 ${backupData.records.length} 条记录！`);

    } catch (error) {
      console.error('数据恢复失败:', error);
      alert('数据恢复失败: ' + error.message);
    }
  };

  reader.onerror = function () {
    alert('读取备份文件失败');
  };

  reader.readAsText(file, 'UTF-8');
}

// Load records from localStorage on startup
function initialLoad() {
  try {
    console.log('开始初始化加载');

    // 首先加载地理编码缓存
    loadGeocodeCache();

    // Read map type from localStorage (for cross-page synchronization)
    const savedMapType = localStorage.getItem('currentMapType');
    if (savedMapType && ['amap', 'google', 'leaflet'].includes(savedMapType)) {
      currentMapType = savedMapType;
      console.log(`从 localStorage 读取地图类型: ${currentMapType}`);
    } else {
      currentMapType = 'amap'; // Default to amap if not found or invalid
    }

    // 初始化对应地图
    if (currentMapType === 'leaflet') {
      leafletMap = initLeafletMap();
      map = leafletMap;
      if (mapSelect) mapSelect.value = 'leaflet';
      // 立即应用主题（如果是暗色模式）
      updateMapTheme();
    } else if (currentMapType === 'google' && window.google && window.google.maps) {
      googleMap = initGoogleMap();
      if (googleMap) {
        map = googleMap;
        if (mapSelect) mapSelect.value = 'google';
      } else {
        currentMapType = 'amap';
        amapInstance = initAmapMap();
        map = amapInstance;
        if (mapSelect) mapSelect.value = 'amap';
      }
    } else { // currentMapType is 'amap' or fallback
      currentMapType = 'amap'; // 确保默认为高德地图
      amapInstance = initAmapMap();
      map = amapInstance;
      if (mapSelect) mapSelect.value = 'amap';
    }

    // 应用当前实体UI
    applyEntityUI(currentEntity);

    // 从localStorage加载记录（按实体）
    records = JSON.parse(localStorage.getItem(getStorageKey())) || [];

    // 先清空表格
    tbody.innerHTML = '';

    // 添加记录到表格（不绘制地图）
    records.forEach(rec => {
      const tr = document.createElement('tr');
      const rpk = rec.distance > 0 ? (rec.cost / rec.distance).toFixed(4) : '';
      tr.innerHTML = `
            <td></td> <!-- Seq # updated later -->
            <td>${rec.date || ''}</td>
            <td>${rec.time || ''}</td>
            <td>${rec.duration || ''}</td>
            <td>${rec.trainNo || ''}</td>
            <td>${rec.startStation || ''}</td>
            <td>${rec.startCity || ''}</td>
            <td>${rec.endStation || ''}</td>
            <td>${rec.endCity || ''}</td>
            <td>${rec.seatClass || ''}</td>
            <td>${rec.trainType || ''}</td>
            <td>${rec.bureau || ''}</td>
            <td>${(rec.cost || 0).toFixed(2)}</td>
            <td>${rec.distance || 0}</td>
            <td>${rpk}</td>
            <td>${(() => {
          const durationMins = parseDurationToMinutes(rec.duration);
          if ((rec.distance || 0) > 0 && durationMins > 0) {
            return ((rec.distance || 0) / (durationMins / 60)).toFixed(1);
          }
          return '';
        })()}</td>
            <td>${rec.notes || ''}</td>
            <td>
              <div class="action-menu">
                <button class="action-menu-btn">⋮</button>
                <div class="action-menu-dropdown">
                  <button class="modify">✏️ 修改</button>
                  <button class="insert">➕ 插入</button>
                  <button class="redraw">🔄 重新画线</button>
                  <button class="delete">🗑️ 删除</button>
                </div>
              </div>
            </td>
          `;
      tbody.appendChild(tr);
      tr._record = rec;
      attachRowEvents(tr);

      // Add dropdown toggle functionality
      const menuBtn = tr.querySelector('.action-menu-btn');
      const menu = tr.querySelector('.action-menu');
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.action-menu.open').forEach(m => {
          if (m !== menu) m.classList.remove('open');
        });
        menu.classList.toggle('open');
      });
    });

    updateSequenceNumbers();

    // 初始化总结面板和图表
    updateSummaryPanels();
    createYearlyCharts();
    updateYearLegend();
    updateStats();

    // 地图完全加载后绘制所有路径
    const handleMapLoad = async function () {
      try {
        // 清空偏移计数器
        Object.keys(counts).forEach(k => delete counts[k]);
        let needGenerate = 0;
        const rows = Array.from(tbody.children);
        for (let i = 0; i < rows.length; i++) {
          const tr = rows[i];
          const rec = records[i];
          if (!rec || !rec.startStation || !rec.endStation) continue;
          if (Array.isArray(rec.pathWGS) && rec.pathWGS.length) {
            // 直接恢复（drawPath 会走恢复分支）
            await drawPath(tr, rec);
          } else {
            needGenerate++;
            await drawPath(tr, rec);
          }
        }
        console.log(`初始加载：已生成新线路 ${needGenerate} 条，已恢复 ${rows.length - needGenerate} 条`);
        updateYearLegend();
      } catch (err) {
        console.error('地图路径绘制失败:', err);
      }
    };

    // 根据地图类型绑定加载完成事件
    if (currentMapType === 'amap' && amapInstance) {
      amapInstance.on('complete', handleMapLoad);
    } else if (currentMapType === 'google' && googleMap) {
      google.maps.event.addListenerOnce(googleMap, 'idle', handleMapLoad);
    } else if (currentMapType === 'leaflet' && leafletMap) {
      // Leaflet maps are ready immediately after creation
      // Use a small timeout to ensure DOM is fully ready
      setTimeout(handleMapLoad, 100);
    }

    clearForm();

    // 应用侧边栏折叠状态（默认折叠以让表格填满页面）
    const collapsed = (localStorage.getItem('sidebarCollapsed') ?? '1') === '1';
    applySidebarState(collapsed);

  } catch (error) {
    console.error('初始化加载失败:', error);
    alert('页面初始化加载失败，请检查控制台日志。\n错误信息: ' + error.message);
  }
}

window.onload = initialLoad;

// ===================== Sorting and Filtering Event Listeners =====================

// ===================== Sorting Event Listeners =====================

document.addEventListener('DOMContentLoaded', () => {
  // Sorting
  document.querySelectorAll('.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.dataset.field;
      if (field) {
        sortRecords(field);
      }
    });
  });

  // Global click listener to close all dropdowns
  document.addEventListener('click', () => {
    document.querySelectorAll('.action-menu.open').forEach(m => {
      m.classList.remove('open');
    });
  });
});

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ===================== Gemini Q&A Feature =====================

if (askGeminiBtn) {
  askGeminiBtn.addEventListener('click', () => {
    geminiQAModalOverlay.style.display = 'flex';
    // Add delay to ensure modal is rendered before focusing
    setTimeout(() => {
      geminiQAInput.focus();
    }, 100);
  });
}

if (geminiQACloseBtn) {
  geminiQACloseBtn.addEventListener('click', () => {
    geminiQAModalOverlay.style.display = 'none';
  });
}

if (geminiQAModalOverlay) {
  geminiQAModalOverlay.addEventListener('click', (e) => {
    if (e.target === geminiQAModalOverlay) {
      geminiQAModalOverlay.style.display = 'none';
    }
  });
}

if (geminiQASendBtn) {
  geminiQASendBtn.addEventListener('click', submitGeminiQuestion);
}

if (geminiQAInput) {
  // Prevent global key handlers from interfering
  geminiQAInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });

  geminiQAInput.addEventListener('keypress', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submitGeminiQuestion();
  });
}

// --- AI API Key Management ---
function getAIKey() {
  const config = API_CONFIG.getAIConfig();
  return config.key;
}

window.saveAIKey = function () {
  const input = document.getElementById('aiKeyInput');
  if (input && input.value.trim()) {
    localStorage.setItem('ai_api_key', input.value.trim());
    alert('API Key 已保存！请重新发送消息。');
    // Remove the form or just let user re-click send
    const form = input.closest('.api-config-form').parentElement; // div.message
    if (form) form.remove();
  } else {
    alert('请输入有效的 API Key');
  }
};

async function submitGeminiQuestion() {
  const question = geminiQAInput.value.trim();
  if (!question) return;

  // Append user question to chat
  appendMessage('user', question);
  geminiQAInput.value = '';

  // Check API Key
  const apiKey = getAIKey();
  if (!apiKey) {
    appendMessage('gemini', `
      <div class="api-config-form">
        <p>⚠️ 检测到未配置 AI API Key，请配置：</p>
        <input type="password" id="aiKeyInput" placeholder="在此输入 API Key (ChatAnywhere/OpenAI)" />
        <button onclick="saveAIKey()">💾 保存配置</button>
        <p style="margin-top:8px;font-size:12px;opacity:0.8;">Key 将仅存储在您的浏览器本地缓存中。</p>
      </div>
    `);
    return;
  }

  // Show loading
  const loadingId = appendMessage('gemini', '<div class="typing-indicator"><span></span><span></span><span></span></div>');

  try {
    // Load ALL records for comprehensive context, matching index.js logic
    let trains = [];
    let planes = [];
    try { trains = JSON.parse(localStorage.getItem('trainRecords')) || []; } catch (e) { }
    try { planes = JSON.parse(localStorage.getItem('planeRecords')) || []; } catch (e) { }

    // Combine and include all relevant fields
    const allRecords = [
      ...trains.map(r => ({
        type: 'Train',
        date: r.date,
        time: r.time,
        duration: r.duration,
        trainNo: r.trainNo,
        startStation: r.startStation,
        startCity: r.startCity,
        endStation: r.endStation,
        endCity: r.endCity,
        seatClass: r.seatClass,
        trainType: r.trainType,
        bureau: r.bureau,
        cost: r.cost,
        distance: r.distance,
        notes: r.notes
      })),
      ...planes.map(r => ({
        type: 'Plane',
        date: r.date,
        time: r.time,
        duration: r.duration,
        flightNo: r.trainNo, // Map trainNo to flightNo for planes
        startAirport: r.startStation, // Map startStation to startAirport
        startCity: r.startCity,
        endAirport: r.endStation, // Map endStation to endAirport
        endCity: r.endCity,
        seatClass: r.seatClass,
        planeType: r.trainType, // Map trainType to planeType
        airline: r.bureau, // Map bureau to airline
        cost: r.cost,
        distance: r.distance,
        notes: r.notes
      }))
    ];

    const dataContext = JSON.stringify(allRecords);
    const prompt = `你是一个旅行数据分析助手。以下是用户的旅行记录数据（JSON格式，包含火车和飞机记录）：
${dataContext}

用户问题：${question}

请回答问题。如果需要列出具体行程，请使用自然语言或Markdown列表的形式（例如：“2023年1月1日从北京去往上海，乘坐G123次列车”），**绝对不要**直接输出JSON格式的数据。`;

    const response = await callAIAPI(prompt);

    // Remove loading and show response
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    if (typeof marked !== 'undefined') {
      appendMessage('gemini', marked.parse(response));
    } else {
      appendMessage('gemini', response);
    }

  } catch (error) {
    console.error('AI Q&A Error:', error);
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendMessage('gemini', `❌ 请求失败: ${error.message}`);
  }
}

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && geminiQAModalOverlay.style.display === 'flex') {
    geminiQAModalOverlay.style.display = 'none';
  }
});

function appendMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = content;
  }

  msgDiv.appendChild(bubble);

  const id = 'msg-' + Date.now();
  msgDiv.id = id;

  geminiQAChatHistory.appendChild(msgDiv);
  geminiQAChatHistory.scrollTop = geminiQAChatHistory.scrollHeight;
  return id;
}

async function callAIAPI(prompt) {
  const config = API_CONFIG.getAIConfig(); // Dynamic Config
  if (!config.key) throw new Error('API Key missing');

  const apiUrl = config.endpoint;
  const model = config.model;

  if (config.provider === 'gemini') {
    // Gemini Official
    // Endpoint base: https://generativelanguage.googleapis.com/v1beta/models
    // Full URL: BASE/{MODEL}:generateContent?key={KEY}

    let urlWithKey;
    if (apiUrl.includes(':generateContent')) {
      urlWithKey = `${apiUrl}?key=${config.key}`;
    } else {
      const modelName = config.model || 'gemini-pro';
      urlWithKey = `${apiUrl}/${modelName}:generateContent?key=${config.key}`;
    }

    const payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const response = await fetch(urlWithKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
      return result.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No valid response from Gemini API');
    }

  } else {
    // Custom / OpenAI Compatible
    const payload = {
      model: model,
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.key}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      return result.choices[0].message.content;
    } else {
      throw new Error('No valid response from AI API');
    }
  }
}

// 谷歌地图API加载完成回调

window.initGoogleMapsAPI = function realInitGoogleMapsAPI() {
  // 避免重复初始化
  if (googleMapsLoaded) { console.log('谷歌地图API已标记加载，跳过重复 init'); return; }
  console.log('🎉 谷歌地图API加载完成回调触发 (real)');
  googleMapsLoaded = true;
  if (currentMapType === 'amap' && mapSelect) {
    mapSelect.disabled = false;
    mapSelect.style.opacity = '1';
    mapSelect.title = '';
    console.log('✅ 地图切换功能已启用');
  } else if (currentMapType === 'google' && !googleMap) {
    // 如果页面初始就是 google 模式且回调刚到，补初始化
    googleMap = initGoogleMap();
  }
};


// ===================== 年度报告功能 =====================
const yearlyReportBtn = document.getElementById('yearlyReportBtn');
const reportModalOverlay = document.getElementById('reportModalOverlay');
const closeReportBtn = document.getElementById('closeReportBtn');
const generateReportBtn = document.getElementById('generateReportBtn');
const reportYearSelect = document.getElementById('reportYearSelect');
const reportContent = document.getElementById('reportContent');
const saveReportImgBtn = document.getElementById('saveReportImgBtn');

if (yearlyReportBtn) {
  yearlyReportBtn.addEventListener('click', openYearlyReport);
}
if (closeReportBtn) {
  closeReportBtn.addEventListener('click', () => {
    reportModalOverlay.style.display = 'none';
  });
}
if (generateReportBtn) {
  generateReportBtn.addEventListener('click', generateYearlyReport);
}
if (saveReportImgBtn) {
  saveReportImgBtn.addEventListener('click', saveReportImage);
}

function openYearlyReport() {
  reportModalOverlay.style.display = 'flex';
  // Populate years
  const years = [...new Set(records.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort().reverse();
  reportYearSelect.innerHTML = '<option value="">选择年份...</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
  // Reset content
  reportContent.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">请选择年份并点击生成</div>';
  saveReportImgBtn.style.display = 'none';
}

function generateYearlyReport() {
  try {
    const year = reportYearSelect.value;
    if (!year) {
      alert('请先选择年份');
      return;
    }

    const yearRecords = records.filter(r => r.date && r.date.startsWith(year));
    if (yearRecords.length === 0) {
      reportContent.innerHTML = '<div style="padding:40px; text-align:center; color:#666;">该年份没有出行记录</div>';
      saveReportImgBtn.style.display = 'none';
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

    // New Metrics
    // 1. Most Active Month
    const monthCounts = {};
    yearRecords.forEach(r => {
      if (r.date) {
        const m = parseInt(r.date.substring(5, 7), 10);
        monthCounts[m] = (monthCounts[m] || 0) + 1;
      }
    });
    const topMonth = Object.keys(monthCounts).sort((a, b) => monthCounts[b] - monthCounts[a])[0];
    const topMonthCount = monthCounts[topMonth] || 0;

    // 2. Longest Distance Trip
    const longestTrip = [...yearRecords].sort((a, b) => (b.distance || 0) - (a.distance || 0))[0];

    // 3. Most Expensive Trip
    const mostExpensiveTrip = [...yearRecords].sort((a, b) => (b.cost || 0) - (a.cost || 0))[0];

    // 4. Longest Duration Trip
    const longestDurationTrip = [...yearRecords].sort((a, b) => parseDurationToMinutes(b.duration) - parseDurationToMinutes(a.duration))[0];

    // 5. First & Last Trip
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

    reportContent.innerHTML = html;
    saveReportImgBtn.style.display = 'block';

  } catch (error) {
    console.error('生成年度报告失败:', error);
    alert('生成年度报告时发生错误: ' + error.message);
  }
}

// Close report on ESC
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && reportModalOverlay.style.display === 'flex') {
    reportModalOverlay.style.display = 'none';
  }
});

function saveReportImage() {
  if (!window.html2canvas) {
    alert('html2canvas 库未加载，无法生成图片');
    return;
  }

  const btn = saveReportImgBtn;
  btn.textContent = '⏳ 生成中...';
  btn.disabled = true;

  html2canvas(document.querySelector('.report-container'), {
    scale: 2, // 高清
    useCORS: true,
    backgroundColor: null // 保持透明或背景色
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `Travel_Report_${reportYearSelect.value}.png`;
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

// ============ Map Interaction Enhancements ============
// 按住 Command (Mac) 或 Alt (Windows) 键开启地图缩放
const isZoomKey = (e) => e.key === 'Meta' || e.key === 'Alt';

window.addEventListener('keydown', (e) => {
  if (isZoomKey(e) && currentMapType === 'amap' && amapInstance) {
    amapInstance.setStatus({ scrollWheel: true });
  }
});

window.addEventListener('keyup', (e) => {
  if (isZoomKey(e) && currentMapType === 'amap' && amapInstance) {
    amapInstance.setStatus({ scrollWheel: false });
  }
});



