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
window.mapLineWidth = 2; // 全局地图线宽控制
window.mapLineOpacity = 0.9; // 全局地图线条透明度控制
window.mapGradientEnabled = false; // 渐变色线条开关
window.mapArrowEnabled = true; // 方向箭头开关

// === 线路编辑模式 ===
window.currentPolylineEditor = null; // 当前编辑器实例
window._editingPolyline = null;      // 当前编辑中的 polyline
window._editingRecord = null;        // 当前编辑中的 record
window._editingTr = null;            // 当前编辑中的 tr


// 新增：地理编码缓存
let geocodeCache = {};

// 自定义地址管理 (优先级高于 API)
window.customAddresses = {};

// 从 localStorage 加载自定义地址
function loadCustomAddresses() {
  try {
    const entityKey = currentEntity ? `custom_addresses_${currentEntity}` : 'custom_addresses';
    const saved = localStorage.getItem(entityKey);
    if (saved) {
      window.customAddresses = JSON.parse(saved);
    } else {
      // 迁移旧数据
      const oldSaved = localStorage.getItem('custom_addresses');
      if (oldSaved) {
        window.customAddresses = JSON.parse(oldSaved);
        saveCustomAddresses(); // 保存到新的由实体区分的 key 中
      } else {
        window.customAddresses = {};
      }
    }
  } catch (e) {
    console.error('Failed to load custom addresses', e);
    window.customAddresses = {};
  }
}

// 保存自定义地址到 localStorage
function saveCustomAddresses() {
  const entityKey = currentEntity ? `custom_addresses_${currentEntity}` : 'custom_addresses';
  localStorage.setItem(entityKey, JSON.stringify(window.customAddresses));
}

// 渲染自定义地址列表
function renderAddressManagerList() {
  const tbody = document.getElementById('addressManagerTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const entries = Object.entries(window.customAddresses);
  if (entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-color); opacity:0.6;">暂无自定义坐标。</td></tr>';
    return;
  }

  // 根据地名拼音或直接字符串排序，让列表更好看
  entries.sort((a, b) => a[0].localeCompare(b[0], 'zh-CN'));

  entries.forEach(([name, coords]) => {
    const tr = document.createElement('tr');
    // 添加 hover 背景色提升交互感
    tr.style.transition = 'background-color 0.2s';
    tr.onmouseover = () => tr.style.backgroundColor = 'var(--hover-bg)';
    tr.onmouseout = () => tr.style.backgroundColor = 'transparent';

    const wgsLng = coords[0];
    const wgsLat = coords[1];

    // Check if within China to convert WGS-84 to GCJ-02
    let gcjLng = '-', gcjLat = '-';
    if (typeof isInChina === 'function' && typeof wgs84ToGcj02 === 'function' && isInChina(wgsLng, wgsLat)) {
      const gcjCoords = wgs84ToGcj02(wgsLng, wgsLat);
      gcjLng = gcjCoords[0].toFixed(6);
      gcjLat = gcjCoords[1].toFixed(6);
    }

    tr.innerHTML = `
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color);">${name}</td>
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color); font-family:monospace; color:#28a745;">${wgsLng.toFixed(6)}</td>
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color); font-family:monospace; color:#28a745;">${wgsLat.toFixed(6)}</td>
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color); font-family:monospace; color:#0d6efd;">${gcjLng}</td>
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color); font-family:monospace; color:#0d6efd;">${gcjLat}</td>
      <td style="padding:10px 16px; border-bottom:1px solid var(--border-color); text-align:center;">
        <div style="display:flex; justify-content:center; gap:8px;">
          <button type="button" class="edit-addr-btn" data-name="${name}" style="background:none; border:none; cursor:pointer; font-size:15px; transition:transform 0.1s;" title="编辑">✏️</button>
          <button type="button" class="del-addr-btn" data-name="${name}" style="background:none; border:none; cursor:pointer; font-size:15px; transition:transform 0.1s;" title="删除">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 绑定编辑事件
  tbody.querySelectorAll('.edit-addr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const name = e.currentTarget.getAttribute('data-name');
      const coords = window.customAddresses[name];
      if (coords) {
        document.getElementById('addAddrName').value = name;
        document.getElementById('addAddrLng').value = coords[0];
        document.getElementById('addAddrLat').value = coords[1];
        document.getElementById('addrFormTitle').textContent = '📝 编辑坐标 (点击保存生效)';
        document.getElementById('addAddrName').focus();

        // 强制复位到 WGS-84 视图以反映数据库真实存的数值
        const wgsRadio = document.querySelector('input[name="coordType"][value="wgs84"]');
        if (wgsRadio) wgsRadio.checked = true;
        window._currentCoordType = 'wgs84';
      }
    });
  });

  // 绑定删除事件
  tbody.querySelectorAll('.del-addr-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const name = e.currentTarget.getAttribute('data-name');
      if (confirm(`确定删除 ${name} 的自定义坐标吗？`)) {
        delete window.customAddresses[name];
        saveCustomAddresses();
        renderAddressManagerList();
      }
    });
  });
}

// 初始化加载
loadCustomAddresses();

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

// 表格筛选元素
const filterYear2 = document.getElementById('filterYear2');
const filterTrainNo = document.getElementById('filterTrainNo');
const filterTrainType = document.getElementById('filterTrainType');
const filterStartStation = document.getElementById('filterStartStation');
const filterStartCity = document.getElementById('filterStartCity');
const filterEndStation = document.getElementById('filterEndStation');
const filterEndCity = document.getElementById('filterEndCity');
const clearTableFilterBtn = document.getElementById('clearTableFilterBtn');

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

// Gemini Q&A Elements → 已迁移到 js/modules/gemini_qa.js

// 图表实例 → 已迁移到 js/modules/charts.js

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
  mapOptions.scaleControl = true; // Show scale bar

  try {
    const googleMapInstance = new google.maps.Map(document.getElementById('mapContainer'), mapOptions);
    console.log('谷歌地图创建成功');

    // Add zoom change listener to update zoom level display
    googleMapInstance.addListener('zoom_changed', () => {
      updateZoomLevelDisplay(googleMapInstance.getZoom());
    });
    // Initial update
    updateZoomLevelDisplay(googleMapInstance.getZoom());

    return googleMapInstance;
  } catch (error) {
    console.error('创建谷歌地图失败:', error);
    alert('创建谷歌地图失败: ' + error.message);
    return null;
  }
}

// Update zoom level display
function updateZoomLevelDisplay(zoom) {
  const zoomLevelValue = document.getElementById('zoomLevelValue');
  if (zoomLevelValue) {
    zoomLevelValue.textContent = Math.round(zoom);
  }
}

// 初始化高德地图
function initAmapMap() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  const amapInstance = new AMap.Map('mapContainer', {
    center: [106.712, 34.205],
    zoom: 5,
    mapStyle: savedTheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE,
    scrollWheel: false, // 默认禁止缩放，需按 Command/Alt 键开启
  });
  // Add Scale Control
  AMap.plugin('AMap.Scale', function () {
    var scale = new AMap.Scale();
    amapInstance && amapInstance.addControl(scale);
  });

  // Add zoom change listener to update zoom level display
  amapInstance.on('zoomchange', () => {
    updateZoomLevelDisplay(amapInstance.getZoom());
  });
  // Initial update
  updateZoomLevelDisplay(amapInstance.getZoom());

  return amapInstance;
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

  // Add Scale Control
  L.control.scale({ imperial: false }).addTo(map);

  // Add zoom change listener to update zoom level display
  map.on('zoomend', () => {
    updateZoomLevelDisplay(map.getZoom());
  });
  // Initial update
  updateZoomLevelDisplay(map.getZoom());

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

  // 高德地图无箭头功能，隐藏箭头开关
  const arrowLabel = document.getElementById('arrowToggle');
  if (arrowLabel) arrowLabel.parentElement.style.display = currentMapType === 'amap' ? 'none' : 'flex';

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
      if (f === 'datetime') {
        return (rec.date || '') + ' ' + (rec.time || '');
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
  let displayRecords = filterYear
    ? records.filter(r => r.date && r.date.substring(0, 4) === filterYear)
    : records;

  // Apply text filters
  if (typeof filterYear2 !== 'undefined' && filterYear2 && filterYear2.value.trim()) {
    const term = filterYear2.value.trim();
    displayRecords = displayRecords.filter(r => r.date && r.date.includes(term));
  }
  if (typeof filterTrainNo !== 'undefined' && filterTrainNo && filterTrainNo.value.trim()) {
    const term = filterTrainNo.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.trainNo || '').toLowerCase().includes(term));
  }
  if (typeof filterTrainType !== 'undefined' && filterTrainType && filterTrainType.value.trim()) {
    const term = filterTrainType.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.trainType || '').toLowerCase().includes(term));
  }
  if (typeof filterStartStation !== 'undefined' && filterStartStation && filterStartStation.value.trim()) {
    const term = filterStartStation.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.startStation || '').toLowerCase().includes(term));
  }
  if (typeof filterStartCity !== 'undefined' && filterStartCity && filterStartCity.value.trim()) {
    const term = filterStartCity.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.startCity || '').toLowerCase().includes(term));
  }
  if (typeof filterEndStation !== 'undefined' && filterEndStation && filterEndStation.value.trim()) {
    const term = filterEndStation.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.endStation || '').toLowerCase().includes(term));
  }
  if (typeof filterEndCity !== 'undefined' && filterEndCity && filterEndCity.value.trim()) {
    const term = filterEndCity.value.trim().toLowerCase();
    displayRecords = displayRecords.filter(r => (r.endCity || '').toLowerCase().includes(term));
  }

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

  // Update sequence numbers (which also attaches checkboxes)
  updateSequenceNumbers();

  // Reset selection stats display when rendering completes
  if (typeof updateSelectionStats === 'function') updateSelectionStats();

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
// parseDurationToMinutes and formatMinutesToDuration moved to utils/helpers.js

// --- 辅助：时长选择器 ---
function buildDurationSelects(initialHHMM = '') {
  // initialHHMM: 'HH:MM' 或空
  let initH = 0, initM = 0;
  const m = (initialHHMM || '').match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) {
    initH = Math.min(80, Math.max(0, parseInt(m[1]) || 0));
    initM = Math.min(59, Math.max(0, parseInt(m[2]) || 0));
  }
  return `
        <span class="duration-editor" title="时长 (HH:MM)" style="display:inline-flex; align-items:center; gap:2px;">
          <input type="number" class="inline-input dur-hour" min="0" max="99" style="width:36px; padding:2px; text-align:center;" value="${initH}" aria-label="小时">
          <span style="opacity:0.6; font-weight:bold;">:</span>
          <input type="number" class="inline-input dur-min" min="0" max="59" style="width:36px; padding:2px; text-align:center;" value="${initM}" aria-label="分钟">
        </span>
      `;
}

function readDurationFromRowCell(td) {
  const hSel = td.querySelector('.dur-hour');
  const mSel = td.querySelector('.dur-min');
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
// updateAllTimeSummary moved to modules/statistics.js

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
// updateYearlySummary moved to modules/statistics.js

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
      updateStats();
      if (typeof updateAllTimeSummary === 'function') updateAllTimeSummary();
      if (typeof createYearlyCharts === 'function') createYearlyCharts();
      if (typeof createBureauChart === 'function') createBureauChart();
      if (typeof createTypeChart === 'function') createTypeChart();
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
      updateStats();
      if (typeof updateAllTimeSummary === 'function') updateAllTimeSummary();
      if (typeof createYearlyCharts === 'function') createYearlyCharts();
      if (typeof createBureauChart === 'function') createBureauChart();
      if (typeof createTypeChart === 'function') createTypeChart();
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
    : records.filter(r => {
      if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
      const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
      return selectedYears.has(year);
    });

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
    : records.filter(r => {
      if (typeof isUserDeselectedAll !== 'undefined' && isUserDeselectedAll) return false;
      const year = r.date ? r.date.substring(0, 4) : new Date().getFullYear().toString();
      return selectedYears.has(year);
    });

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
    // 如果删除后没有选中的年份了，记为用户主动全不选
    if (selectedYears.size === 0) {
      isUserDeselectedAll = true;
    }
  } else {
    selectedYears.add(year);
    isUserDeselectedAll = false; // 如果用户选择了某个年份，重置全不选标志
  }
  updateYearLegend();
  updatePathVisibility();
  updateStats();
  if (typeof updateAllTimeSummary === 'function') updateAllTimeSummary();
  if (typeof createYearlyCharts === 'function') createYearlyCharts();
  if (typeof createBureauChart === 'function') createBureauChart();
  if (typeof createTypeChart === 'function') createTypeChart();
};

// 更新路径可见性
function updatePathVisibility() {
  console.log(`更新路径可见性，选中年份: [${Array.from(selectedYears).join(', ')}]`);

  // 先更新表格行的可见性（同步）
  Array.from(tbody.children).forEach((tr, index) => {
    const record = tr._record || records[index];
    if (!record) return;
    const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
    const shouldShow = isUserDeselectedAll ? false : selectedYears.has(year);
    tr.style.display = shouldShow ? '' : 'none';
  });

  // === 清除地图上所有覆盖物 ===
  try {
    if (currentMapType === 'amap' && amapInstance) {
      amapInstance.clearMap();
    } else if (currentMapType === 'google') {
      Array.from(tbody.children).forEach(tr => {
        if (tr._overlays) tr._overlays.forEach(o => { try { if (o.setMap) o.setMap(null); } catch (_) { } });
      });
    } else if (currentMapType === 'leaflet' && leafletMap) {
      Array.from(tbody.children).forEach(tr => {
        if (tr._overlays) tr._overlays.forEach(o => { try { if (leafletMap.hasLayer(o)) leafletMap.removeLayer(o); } catch (_) { } });
      });
    }
  } catch (e) { console.warn('清除地图覆盖物失败:', e); }

  // === 延迟重新添加选中年份的覆盖物（让地图引擎先完成清除渲染） ===
  setTimeout(() => {
    const overlaysToAdd = [];
    Array.from(tbody.children).forEach((tr, index) => {
      const record = tr._record || records[index];
      if (!record) return;
      const year = record.date ? record.date.substring(0, 4) : new Date().getFullYear().toString();
      const shouldShow = isUserDeselectedAll ? false : selectedYears.has(year);

      if (shouldShow && tr._overlays) {
        tr._overlays.forEach(overlay => overlaysToAdd.push(overlay));
      }
    });

    // 批量添加覆盖物（AMap 支持数组批量添加）
    try {
      if (currentMapType === 'amap' && amapInstance && overlaysToAdd.length > 0) {
        amapInstance.add(overlaysToAdd);
      } else if (currentMapType === 'google') {
        overlaysToAdd.forEach(o => { try { if (o.setMap) o.setMap(googleMap); } catch (_) { } });
      } else if (currentMapType === 'leaflet' && leafletMap) {
        overlaysToAdd.forEach(o => { try { if (!leafletMap.hasLayer(o)) o.addTo(leafletMap); } catch (_) { } });
      }
    } catch (e) { console.warn('重新添加覆盖物失败:', e); }

    console.log(`路径可见性更新完成，已添加 ${overlaysToAdd.length} 个覆盖物`);
  }, 50);
}

// 创建年度统计图表
// ===================== 图表渲染 =====================
// createYearlyCharts, createBureauChart, createTypeChart,
// updateChartsTheme, updateSummaryPanels 已迁移到 js/modules/charts.js

// 新增：安全初始化统计和图表（处理模块加载延迟）
function safeInitStatsAndCharts(retryCount = 0) {
  const maxRetries = 10;
  const retryInterval = 200;

  // 检查关键依赖是否已就绪
  const dependenciesReady =
    typeof updateSummaryPanels === 'function' &&
    typeof createYearlyCharts === 'function' &&
    typeof updateStats === 'function' &&
    typeof Chart !== 'undefined';

  if (dependenciesReady) {
    console.log(`[Init] 统计模块已就绪 (尝试第 ${retryCount} 次)`);
    try {
      updateYearLegend();
      updateSummaryPanels();
      updateStats();
    } catch (e) {
      console.error('[Init] 渲染统计面板失败:', e);
    }
  } else if (retryCount < maxRetries) {
    console.warn(`[Init] 统计模块未就绪，${retryInterval}ms 后重试... (${retryCount + 1}/${maxRetries})`);
    setTimeout(() => safeInitStatsAndCharts(retryCount + 1), retryInterval);
  } else {
    console.error('[Init] 统计模块加载超时，部分图表可能无法显示');
  }
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

// Update sequence numbers and row checkboxes in the table
function updateSequenceNumbers() {
  Array.from(tbody.children).forEach((tr, i) => {
    const isChecked = tr._rowCheckbox && tr._rowCheckbox.checked;
    const cell = tr.cells[COL.seq];
    cell.innerHTML = '';
    
    // Add checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-checkbox';
    cb.style.marginRight = '6px';
    cb.style.cursor = 'pointer';
    if (isChecked) cb.checked = true;
    
    tr._rowCheckbox = cb;

    cb.addEventListener('change', (e) => {
       e.stopPropagation();
       updateSelectionStats();
    });

    // Prevent row sorting toggle or other events from triggering on checkbox click
    cb.addEventListener('click', (e) => e.stopPropagation());

    cell.appendChild(cb);
    cell.appendChild(document.createTextNode(i + 1));
  });
}

// Calculate and update stats for selected rows
function updateSelectionStats() {
  let count = 0;
  let totalCost = 0;
  let totalDistance = 0;
  let totalMinutes = 0;

  const rows = Array.from(tbody.children);
  rows.forEach(tr => {
    const cb = tr._rowCheckbox;
    if (cb && cb.checked && tr._record) {
      count++;
      totalCost += (parseFloat(tr._record.cost) || 0);
      totalDistance += (parseFloat(tr._record.distance) || 0);
      totalMinutes += parseDurationToMinutes(tr._record.duration);
    }
  });

  const statsEl = document.getElementById('selectionStats');
  if (statsEl) {
    if (count > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      const timeStr = hours > 0 ? `${hours}小时${mins}分` : `${mins}分钟`;
      
      statsEl.innerHTML = `已选中 <b style="color:#0d6efd;">${count}</b> 条记录 &nbsp;|&nbsp; 花费 <b>¥${totalCost.toFixed(2)}</b> &nbsp;|&nbsp; 里程 <b>${totalDistance.toLocaleString()}</b> km &nbsp;|&nbsp; 时长 <b>${timeStr}</b>`;
      statsEl.style.display = 'block';
    } else {
      statsEl.style.display = 'none';
    }
  }
  
  const selectAllCb = document.getElementById('selectAllRowsCb');
  if (selectAllCb) {
    selectAllCb.checked = (count > 0 && count === rows.length);
  }
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
            if (o.setOptions) o.setOptions({ strokeWeight: window.mapLineWidth + 3, zIndex: 100 });
          } else if (currentMapType === 'google') {
            if (o.setOptions) o.setOptions({ strokeWeight: window.mapLineWidth + 3, zIndex: 100 });
          } else if (currentMapType === 'leaflet') {
            if (o instanceof L.Polyline) {
              o.setStyle({ weight: window.mapLineWidth + 3 });
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
            if (o.setOptions) o.setOptions({ strokeWeight: window.mapLineWidth, zIndex: 50 });
          } else if (currentMapType === 'google') {
            if (o.setOptions) o.setOptions({ strokeWeight: window.mapLineWidth, zIndex: 50 });
          } else if (currentMapType === 'leaflet') {
            if (o instanceof L.Polyline) {
              o.setStyle({ weight: window.mapLineWidth });
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

// ===================== 表格行内编辑 =====================
// enterInlineEdit, collectRowData, renderRowFromData, saveInlineEdit, cancelInlineEdit, insertInlineAfter 已迁移到 js/modules/table_editor.js


// （已移除国际/中文判断函数：仅使用统一的 Nominatim 查询）

// ===================== 地理编码与路径绘制 =====================
// geocode, buildGeocodeQuery, sleep, drawPath, generateArcPath, redrawAllPaths, forceRedrawAllPaths
// 已迁移到 js/modules/geocoding.js

// （路径单独缓存逻辑已移除，路径数据直接伴随记录保存）

// --- Initial Load & Event Listeners ---

// Set initial theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.body.classList.toggle('dark', savedTheme === 'dark');
themeToggle.textContent = savedTheme === 'dark' ? '切换浅色模式' : '切换暗色模式';

// 地点标记显示设置已移除

// 表格筛选事件监听
[filterYear2, filterTrainNo, filterTrainType, filterStartStation, filterStartCity, filterEndStation, filterEndCity].forEach(input => {
  if (input) {
    input.addEventListener('input', () => {
      rerenderTable(yearSelect.value);
    });
  }
});

if (clearTableFilterBtn) {
  clearTableFilterBtn.addEventListener('click', () => {
    if (filterYear2) filterYear2.value = '';
    if (filterTrainNo) filterTrainNo.value = '';
    if (filterTrainType) filterTrainType.value = '';
    if (filterStartStation) filterStartStation.value = '';
    if (filterStartCity) filterStartCity.value = '';
    if (filterEndStation) filterEndStation.value = '';
    if (filterEndCity) filterEndCity.value = '';
    rerenderTable(yearSelect.value);
  });
}

const selectAllRowsCb = document.getElementById('selectAllRowsCb');
if (selectAllRowsCb) {
  // Prevent clicking the checkbox from triggering the TH sorting
  selectAllRowsCb.addEventListener('click', (e) => e.stopPropagation());

  selectAllRowsCb.addEventListener('change', (e) => {
    const checked = e.target.checked;
    Array.from(tbody.children).forEach(tr => {
      if (tr._rowCheckbox) {
        tr._rowCheckbox.checked = checked;
      }
    });
    updateSelectionStats();
  });
}

const toggleSelectionBtn = document.getElementById('toggleSelectionBtn');
let isSelectionMode = false;
if (toggleSelectionBtn) {
  toggleSelectionBtn.addEventListener('click', () => {
    isSelectionMode = !isSelectionMode;
    const historyTable = document.getElementById('historyTable');
    if (!historyTable) return;
    
    if (isSelectionMode) {
      historyTable.classList.add('show-checkboxes');
      toggleSelectionBtn.style.background = '#dc3545'; // bootstrap danger red
      toggleSelectionBtn.textContent = '退出多选';
    } else {
      historyTable.classList.remove('show-checkboxes');
      toggleSelectionBtn.style.background = 'var(--primary-color, #0d6efd)';
      toggleSelectionBtn.textContent = '多选统计';
      
      const selectAllCb = document.getElementById('selectAllRowsCb');
      if (selectAllCb) selectAllCb.checked = false;
      Array.from(tbody.children).forEach(tr => {
        if (tr._rowCheckbox) tr._rowCheckbox.checked = false;
      });
      updateSelectionStats();
    }
  });
}

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
  // 根据当前数据类型 (train/plane) 加载对应的自定义地址字典
  loadCustomAddresses();

  // 渲染表格行（不立即绘制路径，避免地图状态未就绪）
  tbody.innerHTML = '';
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
  updateYearLegend();
  updateSummaryPanels();
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
// 初始化时，高德隐藏箭头开关
(function () { const at = document.getElementById('arrowToggle'); if (at) at.parentElement.style.display = currentMapType === 'amap' ? 'none' : 'flex'; })();

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
let replayPolylines = []; // Store replay polylines for cleanup
let replayCurrentMarker = null; //  Store current animated marker
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


let replayCumulativeDistance = 0;
let replayCumulativeTime = 0;

// Custom Route Viewer globals
let customRouteMapInstance = null;
let customRoutePolylines = [];
let customRouteAnimationId = null;
let customRoutePaused = false;



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
    // 绑定键盘快捷键 (Space for Pause/Resume)
    const keyHandler = (e) => {
      if (replayOverlay.style.display !== 'flex') return;
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
    insertInlineAtTop();
  });
}

// ===================== 数据导入导出功能 =====================
// importCsv, parseCsvLine, parseCsvToRecords, exportToCsv,
// importExcel, exportToJson 已迁移到 js/modules/data_io.js



// backupData, restoreData 已迁移到 js/modules/backup_restore.js

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
    console.log(`从 localStorage 加载了 ${records.length} 条记录`);

    // 默认按日期时间排序（这会自动调用 rerenderTable）
    sortState.field = 'datetime';
    sortState.order = 'asc';
    sortRecords('datetime');

    // updateSequenceNumbers 会在 rerenderTable 中调用，不需要重复
    // 初始化总结面板和图表 - 改为安全初始化
    safeInitStatsAndCharts();

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
  // === 地址坐标管理 UI 绑定 ===
  const addrBtn = document.getElementById('addressManagerBtn');
  const addrModal = document.getElementById('addressManagerModalOverlay');
  const addrClose = document.getElementById('addressManagerCloseBtn');
  const addAddrBtn = document.getElementById('addAddrBtn');

  if (addrBtn && addrModal && addrClose && addAddrBtn) {
    addrBtn.addEventListener('click', () => {
      renderAddressManagerList();
      addrModal.style.display = 'flex';
    });

    addrClose.addEventListener('click', () => {
      addrModal.style.display = 'none';
      // 提示用户可能需要重新绘制
      showToast('提示：如果修改了已画线的坐标，请点击"重新绘制线路"生效。', 'info');
    });

    // 新增：坐标类型实时切换逻辑
    const radios = document.querySelectorAll('input[name="coordType"]');
    const lngInput = document.getElementById('addAddrLng');
    const latInput = document.getElementById('addAddrLat');
    window._currentCoordType = 'wgs84';

    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const newType = e.target.value;
        if (newType === window._currentCoordType) return;

        const lng = parseFloat(lngInput.value);
        const lat = parseFloat(latInput.value);

        if (!isNaN(lng) && !isNaN(lat)) {
          if (window._currentCoordType === 'wgs84' && newType === 'gcj02') {
            const gcj = typeof wgs84ToGcj02 === 'function' ? wgs84ToGcj02(lng, lat) : [lng, lat];
            lngInput.value = gcj[0].toFixed(6);
            latInput.value = gcj[1].toFixed(6);
          } else if (window._currentCoordType === 'gcj02' && newType === 'wgs84') {
            const wgs = typeof gcj02ToWgs84 === 'function' ? gcj02ToWgs84(lng, lat) : [lng, lat];
            lngInput.value = wgs[0].toFixed(6);
            latInput.value = wgs[1].toFixed(6);
          }
        }
        window._currentCoordType = newType;
      });
    });

    // 新增：清空按钮逻辑
    const clearAddrBtn = document.getElementById('clearAddrBtn');
    if (clearAddrBtn) {
      clearAddrBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('addAddrName').value = '';
        lngInput.value = '';
        latInput.value = '';
        document.getElementById('addrFormTitle').textContent = '新增 / 编辑坐标';
        const wgsRadio = document.querySelector('input[name="coordType"][value="wgs84"]');
        if (wgsRadio) wgsRadio.checked = true;
        window._currentCoordType = 'wgs84';
      });
    }

    addAddrBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const nameElem = document.getElementById('addAddrName');

      const name = nameElem.value.trim();
      let lng = parseFloat(lngInput.value);
      let lat = parseFloat(latInput.value);

      if (!name) return alert('请输入地点名称');
      if (isNaN(lng) || isNaN(lat)) return alert('请输入有效的经纬度数值');
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return alert('经纬度超出合理范围');

      // 如果当前是 GCJ-02 视图，则必须转换为 WGS-84 保存（核心系统字典全跑 WGS-84）
      if (window._currentCoordType === 'gcj02') {
        const wgs = typeof gcj02ToWgs84 === 'function' ? gcj02ToWgs84(lng, lat) : [lng, lat];
        lng = wgs[0];
        lat = wgs[1];
      }

      window.customAddresses[name] = [lng, lat];
      saveCustomAddresses();
      renderAddressManagerList();

      // 清空输入框并重置状态
      nameElem.value = '';
      lngInput.value = '';
      latInput.value = '';
      document.getElementById('addrFormTitle').textContent = '新增 / 编辑坐标';
      const wgsRadio = document.querySelector('input[name="coordType"][value="wgs84"]');
      if (wgsRadio) wgsRadio.checked = true;
      window._currentCoordType = 'wgs84';
    });
  }
  // ==============================

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

  // Line width slider listener
  const lineWidthSlider = document.getElementById('lineWidthSlider');
  const lineWidthValue = document.getElementById('lineWidthValue');
  if (lineWidthSlider && lineWidthValue) {
    lineWidthSlider.addEventListener('input', (e) => {
      window.mapLineWidth = parseFloat(e.target.value);
      lineWidthValue.textContent = window.mapLineWidth.toFixed(1);
      // Redraw paths to apply new width
      updatePathVisibility(); // Depending on implementation, you might need to recreate them
      // We will actually just update the existing overlays if possible, or trigger a full redraw
      // Trigger full render to update paths if needed, or we can update overlays
      Array.from(tbody.children).forEach(tr => {
        if (tr._overlays && tr.style.display !== 'none') {
          tr._overlays.forEach(overlay => {
            if (currentMapType === 'amap') {
              if (overlay.setOptions && overlay.getPath) {
                overlay.setOptions({ strokeWeight: window.mapLineWidth });
              }
            } else if (currentMapType === 'google') {
              if (overlay.setOptions && overlay.getPath) {
                overlay.setOptions({ strokeWeight: window.mapLineWidth });
              }
            } else if (currentMapType === 'leaflet') {
              if (overlay.setStyle && overlay.getLatLngs) {
                overlay.setStyle({ weight: window.mapLineWidth });
              }
            }
          });
        }
      });
    });
  }

  // 透明度滑块事件
  const lineOpacitySlider = document.getElementById('lineOpacitySlider');
  const lineOpacityValue = document.getElementById('lineOpacityValue');
  if (lineOpacitySlider && lineOpacityValue) {
    lineOpacitySlider.addEventListener('input', (e) => {
      window.mapLineOpacity = parseFloat(e.target.value);
      lineOpacityValue.textContent = window.mapLineOpacity.toFixed(1);
      // 实时更新所有可见线条的透明度
      Array.from(tbody.children).forEach(tr => {
        if (tr._overlays && tr.style.display !== 'none') {
          tr._overlays.forEach(overlay => {
            if (currentMapType === 'amap') {
              if (overlay.setOptions && overlay.getPath) {
                overlay.setOptions({ strokeOpacity: window.mapLineOpacity });
              }
            } else if (currentMapType === 'google') {
              if (overlay.setOptions && overlay.getPath) {
                overlay.setOptions({ strokeOpacity: window.mapLineOpacity });
              }
            } else if (currentMapType === 'leaflet') {
              if (overlay.setStyle && overlay.getLatLngs) {
                overlay.setStyle({ opacity: window.mapLineOpacity });
              }
            }
          });
        }
      });
    });
  }

  // 渐变色开关事件
  const gradientToggle = document.getElementById('gradientToggle');
  if (gradientToggle) {
    gradientToggle.addEventListener('change', (e) => {
      window.mapGradientEnabled = e.target.checked;
      // 切换渐变需要重绘所有线路
      redrawAllPaths();
    });
  }

  // 方向箭头开关事件
  const arrowToggle = document.getElementById('arrowToggle');
  if (arrowToggle) {
    arrowToggle.addEventListener('change', (e) => {
      window.mapArrowEnabled = e.target.checked;
      redrawAllPaths();
    });
  }

  // 线路编辑按钮事件
  const finishEditBtn = document.getElementById('finishEditBtn');
  if (finishEditBtn) {
    finishEditBtn.addEventListener('click', finishPolylineEdit);
  }
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', cancelPolylineEdit);
  }
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
// 已迁移到 js/modules/gemini_qa.js


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
// 已迁移到 js/modules/yearly_report.js


// ============ Map Interaction Enhancements ============
// 按住 Command (Mac) 或 Alt (Windows) 键开启地图缩放
const isZoomKey = (e) => e.key === 'Meta' || e.key === 'Alt';

window.addEventListener('keydown', (e) => {
  if (isZoomKey(e) && currentMapType === 'amap' && amapInstance) {
    amapInstance.setStatus({ scrollWheel: true });
  }
});

// ===================== Global Unified ESC Handler =====================
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // 1. Context Menu
  const contextMenu = document.getElementById('polylineContextMenu');
  if (contextMenu && contextMenu.style.display === 'block') {
    contextMenu.style.display = 'none';
  }

  // 2. Route Info Modal (Dynamic)
  const routeModal = document.getElementById('routeInfoModal');
  if (routeModal && routeModal.style.display === 'flex') {
    const content = routeModal.querySelector('#routeInfoContent');
    routeModal.style.opacity = '0';
    if (content) content.style.transform = 'translateY(20px)';
    setTimeout(() => routeModal.style.display = 'none', 200);
  }

  // 3. Overlay Modals
  const overlays = [
    { id: 'geminiQAModalOverlay' },
    { id: 'reportModalOverlay' },
    { id: 'customRouteOverlay', closeBtn: 'customRouteCloseBtn' },
    { id: 'replayOverlay', closeBtn: 'replayCloseBtn' },
    { id: 'featuresHelpOverlay' },
    { id: 'addressManagerModalOverlay', closeBtn: 'addressManagerCloseBtn' },
    { id: 'cloudSettingsModalOverlay', closeBtn: 'cloudSettingsCancelBtn' }
  ];

  overlays.forEach(overlay => {
    const el = document.getElementById(overlay.id);
    if (el && (el.style.display === 'flex' || el.style.display === 'block')) {
      if (overlay.closeBtn) {
        const btn = document.getElementById(overlay.closeBtn);
        if (btn) btn.click();
      } else {
        el.style.display = 'none';
      }
    }
  });

  // 4. Table Action Menus
  document.querySelectorAll('.action-menu.open').forEach(m => {
    m.classList.remove('open');
  });
});

window.addEventListener('keyup', (e) => {
  if (isZoomKey(e) && currentMapType === 'amap' && amapInstance) {
    amapInstance.setStatus({ scrollWheel: false });
  }
});




