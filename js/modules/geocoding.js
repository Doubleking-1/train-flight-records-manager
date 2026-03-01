// ===================================
// 地理编码与路径绘制模块 (Geocoding Module)
// ===================================
//
// 负责地点转换、路径生成与重绘
// 依赖全局: records, geocodeCache, currentMapType, amapInstance, googleMap, leafletMap,
//           counts, saveGeocodeCache(), isInChina, wgs84ToGcj02, saveRecords(),
//           getYearColor(), selectedYears, addPathErrorUI(), isUserDeselectedAll,
//           updateYearLegend()

console.log('[Geocoding Module] 加载中...');

// ===================== 仅使用 Nominatim 的正向地理编码 =====================
// 需求：只调用 https://nominatim.openstreetmap.org/search 获取 WGS84，再按需中国境内转换 GCJ-02 用于高德底图。不得调用谷歌/高德官方地理编码。
// geocode(station, city) 返回 WGS84 [lon, lat]，转换在使用处（绘制到高德时）进行。

function geocode(station, city) {
  if (!station) return Promise.reject(new Error('station 为空'));
  // 调整：只使用用户输入的站名原文（去前后空格），不再自动补“站”字，也不拼接城市
  const query = station.trim();

  // 1. 最高优先级拦截：如果我们已经保存了该地点的自定义地址，直接使用该地址 (WGS84 格式)
  if (window.customAddresses && window.customAddresses[query]) {
    console.log(`[Geocoding] 优先匹配自定义坐标字典: ${query} ->`, window.customAddresses[query]);
    return Promise.resolve([...window.customAddresses[query]]);
  }

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

// Coordinate conversion functions (isInChina, wgs84ToGcj02, transformLat, transformLon) moved to utils/helpers.js
// ================== Nominatim-only 结束 ==================

// 通用延迟工具
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 右键菜单组件辅助函数
function showPolylineContextMenu(e, tr, record) {
  // Prevent default context menu just in case
  if (e && e.preventDefault) e.preventDefault();

  // Extract clientX, clientY safely across map engines
  let clientX = window.innerWidth / 2, clientY = window.innerHeight / 2;
  if (e) {
    if (e.originalEvent) { clientX = e.originalEvent.clientX; clientY = e.originalEvent.clientY; } // Leaflet
    else if (e.domEvent) { clientX = e.domEvent.clientX; clientY = e.domEvent.clientY; } // Google
    else if (e.originEvent) { clientX = e.originEvent.clientX; clientY = e.originEvent.clientY; } // AMap
    else if (e.clientX !== undefined) { clientX = e.clientX; clientY = e.clientY; }
  }

  let menu = document.getElementById('polylineContextMenu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'polylineContextMenu';
    menu.className = 'context-menu';
    // Use innerHTML instead of modifying React/Vue states since this is Vanilla JS
    menu.innerHTML = `
      <div class="menu-item" id="ctxShowInfo">ℹ️ 查看详情</div>
      <div class="menu-item" id="ctxRedrawLine" style="color:var(--primary-color);">🔄 重新画线</div>
    `;
    document.body.appendChild(menu);

    // Hide on outside click
    document.addEventListener('click', (ev) => {
      if (menu.style.display !== 'none' && !menu.contains(ev.target)) {
        menu.style.display = 'none';
      }
    });

    // Hide on scroll just in case
    window.addEventListener('scroll', () => { menu.style.display = 'none'; }, { passive: true });
    document.getElementById('container').addEventListener('wheel', () => { menu.style.display = 'none'; }, { passive: true });
  }

  // Adjust position logic 
  menu.style.display = 'block';
  // Check bounds so it doesn't flow off screen
  const rect = menu.getBoundingClientRect();
  if (clientX + rect.width > window.innerWidth) clientX -= rect.width;
  if (clientY + rect.height > window.innerHeight) clientY -= rect.height;

  menu.style.left = clientX + 'px';
  menu.style.top = clientY + 'px';

  const redrawBtn = menu.querySelector('#ctxRedrawLine');
  redrawBtn.onclick = () => {
    menu.style.display = 'none';
    if (confirm(`确定要重新获取“${record.startStation}→${record.endStation}”的坐标并重绘此地图线路吗？`)) {
      const actionBtn = tr.querySelector('.action-menu .redraw');
      if (actionBtn) actionBtn.click();
    }
  };

  const infoBtn = menu.querySelector('#ctxShowInfo');
  infoBtn.onclick = () => {
    menu.style.display = 'none';
    let modal = document.getElementById('routeInfoModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'routeInfoModal';
      modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10001; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(3px); opacity:0; transition:opacity 0.2s;';

      const content = document.createElement('div');
      content.id = 'routeInfoContent';
      content.style.cssText = 'background:var(--modal-bg); width:90%; max-width:400px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.3); transform:translateY(20px); transition:transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); overflow:hidden; border:1px solid var(--border-color);';

      modal.appendChild(content);
      document.body.appendChild(modal);

      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          content.style.transform = 'translateY(20px)';
          setTimeout(() => modal.style.display = 'none', 200);
        }
      };
    }
    const content = modal.querySelector('#routeInfoContent');
    const noObj = record.trainNo || record.flightNum || '未知班次';
    let speed = '--';
    let durationDisplay = record.duration || '--';
    if (record.duration) {
      const mins = typeof parseDurationToMinutes === 'function' ? parseDurationToMinutes(record.duration) : 0;
      if (mins > 0) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        durationDisplay = h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
        speed = (record.distance / (mins / 60)).toFixed(1) + ' km/h';
      }
    }

    content.innerHTML = `
      <div style="background:var(--primary-color); color:#fff; padding:16px 20px; font-size:16px; font-weight:bold; display:flex; justify-content:space-between; align-items:center;">
        <span>🎫 行程详情</span>
        <span id="closeRouteInfoBtn" style="cursor:pointer; opacity:0.8; font-size:22px; line-height:1;">&times;</span>
      </div>
      <div style="padding:24px 20px; display:flex; flex-direction:column; gap:12px; font-size:14px; color:var(--text-color);">
        <div style="display:flex; justify-content:space-between; padding-bottom:12px; border-bottom:1px dashed var(--border-color); text-align:center;">
          <div style="flex:1;">
            <div style="font-size:20px; font-weight:bold; color:var(--primary-color);">${record.startCity}</div>
            <div style="font-size:12px; opacity:0.8; margin-top:4px;">${record.startStation}</div>
          </div>
          <div style="display:flex; flex-direction:column; justify-content:center; padding:0 10px;">
             <span style="font-size:12px; background:rgba(13,110,253,0.1); color:var(--primary-color); padding:2px 8px; border-radius:10px;">${noObj}</span>
             <span style="font-size:16px; margin-top:2px; color:var(--text-color);">➔</span>
          </div>
          <div style="flex:1;">
            <div style="font-size:20px; font-weight:bold; color:var(--primary-color);">${record.endCity}</div>
            <div style="font-size:12px; opacity:0.8; margin-top:4px;">${record.endStation}</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px;">
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">📅 日期</div>
             <div style="font-weight:600;">${record.date || '--'}</div>
           </div>
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">💺 席别</div>
             <div style="font-weight:600;">${record.seatClass || '--'}</div>
           </div>
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">🛣️ 里程</div>
             <div style="font-weight:600;">${record.distance ? record.distance + ' km' : '--'}</div>
           </div>
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">⏱️ 时长</div>
             <div style="font-weight:600;">${durationDisplay}</div>
           </div>
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">💰 票价</div>
             <div style="font-weight:600;">${record.cost ? '¥' + record.cost : '--'}</div>
           </div>
           <div style="background:var(--bg-color); padding:8px 12px; border-radius:6px; border:1px solid var(--border-color);">
             <div style="font-size:11px; opacity:0.7; margin-bottom:4px;">⚡ 均速</div>
             <div style="font-weight:600;">${speed}</div>
           </div>
        </div>
      </div>
    `;

    document.getElementById('closeRouteInfoBtn').onclick = () => {
      modal.style.opacity = '0';
      content.style.transform = 'translateY(20px)';
      setTimeout(() => modal.style.display = 'none', 200);
    };

    modal.style.display = 'flex';
    // trigger reflow
    void modal.offsetWidth;
    modal.style.opacity = '1';
    content.style.transform = 'translateY(0)';
  };
}

// Draw the path on the map for a given record - 仅使用 Nominatim (WGS84) + 中国境内 WGS→GCJ 转换
// --- 方向计算 Helper ---
function computeHeading(p1, p2) {
  const lat1 = p1[1] * Math.PI / 180;
  const lon1 = p1[0] * Math.PI / 180;
  const lat2 = p2[1] * Math.PI / 180;
  const lon2 = p2[0] * Math.PI / 180;
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let brng = Math.atan2(y, x);
  return (brng * 180 / Math.PI + 360) % 360;
}
function getPathMidHeading(path) {
  if (path.length < 2) return 0;
  const mid = Math.floor(path.length / 2);
  const p1 = mid > 0 ? path[mid - 1] : path[0];
  const p2 = mid + 1 < path.length ? path[mid + 1] : path[path.length - 1];
  return computeHeading(p1, p2);
}

function getArrowHtml(heading, color) {
  return `<div style="pointer-events: none; transform: rotate(${heading}deg); transform-origin: center; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14"><polygon points="0,14 7,0 14,14 7,9" fill="${color}" stroke="${color}" stroke-width="1" opacity="${window.mapLineOpacity || 0.6}"/></svg>
  </div>`;
}

async function drawPath(tr, record) {
  if (!record.startStation || !record.endStation) return;

  // --- 强制清理：每次绘制前确保旧覆盖物已移除，防止重影 ---
  if (tr._overlays && tr._overlays.length > 0) {
    tr._overlays.forEach(o => {
      try {
        if (currentMapType === 'amap') {
          if (o.setMap) o.setMap(null);
          if (typeof amapInstance !== 'undefined' && amapInstance.remove) amapInstance.remove(o);
        } else if (currentMapType === 'google') {
          if (o.setMap) o.setMap(null);
        } else if (currentMapType === 'leaflet') {
          if (o.remove) o.remove();
        }
      } catch (err) { console.warn('清理旧覆盖物失败:', err); }
    });
    tr._overlays = [];
  }

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
        const polyline = new AMap.Polyline({ path: gcjPath, isOutline: false, strokeColor, strokeWeight: window.mapLineWidth, strokeOpacity: window.mapLineOpacity, strokeStyle: 'solid', zIndex: 50 });

        // Interaction Events (AMap)
        polyline.on('mouseover', () => {
          polyline.setOptions({ strokeWeight: window.mapLineWidth + 3, zIndex: 100 });
          tr.classList.add('highlight-row');
        });
        polyline.on('mouseout', () => {
          polyline.setOptions({ strokeWeight: window.mapLineWidth, zIndex: 50 });
          tr.classList.remove('highlight-row');
        });
        polyline.on('click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });
        polyline.on('rightclick', (e) => {
          showPolylineContextMenu(e, tr, record);
        });

        amapInstance.add(polyline); overlays.push(polyline);
        if (gcjPath.length) {
          const mid = gcjPath[Math.floor(gcjPath.length / 2)];
          const label = new AMap.Text({ text: year, position: mid, style: { 'font-size': '12px', 'font-weight': 'bold', 'color': strokeColor, 'background-color': 'rgba(255,255,255,0.8)', 'border': '1px solid ' + strokeColor, 'border-radius': '3px', 'padding': '2px 4px', 'text-align': 'center' }, offset: [0, -10], zIndex: 50 });
          amapInstance.add(label); overlays.push(label);


        }
      } else if (currentMapType === 'google') {
        const googlePath = record.pathWGS.map(p => ({ lat: p[1], lng: p[0] }));
        const polyline = new google.maps.Polyline({
          path: googlePath,
          geodesic: false,
          strokeColor: getYearColor(year),
          strokeOpacity: window.mapLineOpacity,
          strokeWeight: window.mapLineWidth,
          icons: [{
            icon: {
              path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
              fillColor: getYearColor(year),
              fillOpacity: window.mapLineOpacity,
              strokeWeight: 0,
              scale: window.mapLineWidth > 2 ? 3 : 2
            },
            offset: '50%'
          }],
          zIndex: 50
        });

        // Interaction Events (Google Maps)
        google.maps.event.addListener(polyline, 'mouseover', () => {
          polyline.setOptions({ strokeWeight: window.mapLineWidth + 3, zIndex: 100 });
          tr.classList.add('highlight-row');
        });
        google.maps.event.addListener(polyline, 'mouseout', () => {
          polyline.setOptions({ strokeWeight: window.mapLineWidth, zIndex: 50 });
          tr.classList.remove('highlight-row');
        });
        google.maps.event.addListener(polyline, 'click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });
        google.maps.event.addListener(polyline, 'rightclick', (e) => {
          showPolylineContextMenu(e, tr, record);
        });

        polyline.setMap(googleMap); overlays.push(polyline);
      } else if (currentMapType === 'leaflet') {
        // 使用 Leaflet 绘制已存路径
        const latLngs = record.pathWGS.map(p => [p[1], p[0]]); // Leaflet uses [lat, lon]
        const polyline = L.polyline(latLngs, {
          color: strokeColor,
          weight: window.mapLineWidth,
          opacity: window.mapLineOpacity,
          smoothFactor: 1
        }).addTo(leafletMap);

        if (record.pathWGS.length) {
          const midInfo = record.pathWGS[Math.floor(record.pathWGS.length / 2)];
          const ptLat = midInfo[1], ptLng = midInfo[0];
          const heading = getPathMidHeading(record.pathWGS);
          const arrowMarker = L.marker([ptLat, ptLng], {
            icon: L.divIcon({ html: getArrowHtml(heading, strokeColor), className: 'custom-arrow-icon', iconSize: [14, 14], iconAnchor: [7, 7] }),
            interactive: false
          }).addTo(leafletMap);
          overlays.push(arrowMarker);
        }

        polyline.on('mouseover', () => {
          polyline.setStyle({ weight: window.mapLineWidth + 3 });
          polyline.bringToFront();
          tr.classList.add('highlight-row');
        });
        polyline.on('mouseout', () => {
          polyline.setStyle({ weight: window.mapLineWidth });
          tr.classList.remove('highlight-row');
        });
        polyline.on('click', () => {
          tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          tr.classList.add('highlight-row');
          setTimeout(() => tr.classList.remove('highlight-row'), 1500);
        });
        polyline.on('contextmenu', (e) => {
          showPolylineContextMenu(e, tr, record);
        });
        overlays.push(polyline);
      }
      tr._overlays = overlays;
      const shouldShow = isUserDeselectedAll ? false : (selectedYears.size === 0 || selectedYears.has(year));
      if (!shouldShow) overlays.forEach(o => {
        try {
          if (currentMapType === 'amap') { try { amapInstance.remove(o); } catch (_) { } }
          else if (currentMapType === 'google') { if (o.setMap) o.setMap(null); }
          else if (currentMapType === 'leaflet') { try { leafletMap.removeLayer(o); } catch (_) { } }
        } catch (_) { }
      });
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
      const polyline = new AMap.Polyline({ path: gcjPath, isOutline: false, strokeColor, strokeWeight: window.mapLineWidth, strokeOpacity: window.mapLineOpacity, strokeStyle: 'solid' });
      polyline.on('mouseover', () => { polyline.setOptions({ strokeWeight: window.mapLineWidth + 3 }); tr.classList.add('highlight-row'); });
      polyline.on('mouseout', () => { polyline.setOptions({ strokeWeight: window.mapLineWidth }); tr.classList.remove('highlight-row'); });
      polyline.on('click', () => { tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); tr.classList.add('highlight-row'); setTimeout(() => tr.classList.remove('highlight-row'), 1500); });
      polyline.on('rightclick', (e) => {
        showPolylineContextMenu(e, tr, record);
      });

      amapInstance.add(polyline); overlays.push(polyline);
      if (gcjPath.length) {
        const mid = gcjPath[Math.floor(gcjPath.length / 2)];
        const label = new AMap.Text({ text: year, position: mid, style: { 'font-size': '12px', 'font-weight': 'bold', 'color': strokeColor, 'background-color': 'rgba(255,255,255,0.8)', 'border': '1px solid ' + strokeColor, 'border-radius': '3px', 'padding': '2px 4px', 'text-align': 'center' }, offset: [0, -10] });
        amapInstance.add(label); overlays.push(label);


      }
    } else if (currentMapType === 'google') {
      const googlePath = wgsPath.map(p => ({ lat: p[1], lng: p[0] }));
      const polyline = new google.maps.Polyline({
        path: googlePath,
        geodesic: false,
        strokeColor,
        strokeOpacity: window.mapLineOpacity,
        strokeWeight: window.mapLineWidth,
        icons: [{
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: strokeColor,
            fillOpacity: window.mapLineOpacity,
            strokeWeight: 0,
            scale: window.mapLineWidth > 2 ? 3 : 2
          },
          offset: '50%'
        }]
      });
      google.maps.event.addListener(polyline, 'mouseover', () => { polyline.setOptions({ strokeWeight: window.mapLineWidth + 3 }); tr.classList.add('highlight-row'); });
      google.maps.event.addListener(polyline, 'mouseout', () => { polyline.setOptions({ strokeWeight: window.mapLineWidth }); tr.classList.remove('highlight-row'); });
      google.maps.event.addListener(polyline, 'click', () => { tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); tr.classList.add('highlight-row'); setTimeout(() => tr.classList.remove('highlight-row'), 1500); });
      google.maps.event.addListener(polyline, 'rightclick', (e) => {
        showPolylineContextMenu(e, tr, record);
      });
      polyline.setMap(googleMap); overlays.push(polyline);
    } else if (currentMapType === 'leaflet') {
      // Leaflet 绘制新路径
      const latLngs = wgsPath.map(p => [p[1], p[0]]);
      const polyline = L.polyline(latLngs, {
        color: strokeColor,
        weight: window.mapLineWidth,
        opacity: window.mapLineOpacity,
        smoothFactor: 1
      }).addTo(leafletMap);

      if (wgsPath.length) {
        const midInfo = wgsPath[Math.floor(wgsPath.length / 2)];
        const heading = getPathMidHeading(wgsPath);
        const arrowMarker = L.marker([midInfo[1], midInfo[0]], {
          icon: L.divIcon({ html: getArrowHtml(heading, strokeColor), className: 'custom-arrow-icon', iconSize: [14, 14], iconAnchor: [7, 7] }),
          interactive: false
        }).addTo(leafletMap);
        overlays.push(arrowMarker);
      }

      // Bind Interactions
      polyline.on('mouseover', () => { polyline.setStyle({ weight: window.mapLineWidth + 3 }); polyline.bringToFront(); tr.classList.add('highlight-row'); });
      polyline.on('mouseout', () => { polyline.setStyle({ weight: window.mapLineWidth }); tr.classList.remove('highlight-row'); });
      polyline.on('click', () => { tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); tr.classList.add('highlight-row'); setTimeout(() => tr.classList.remove('highlight-row'), 1500); });
      polyline.on('contextmenu', (e) => {
        showPolylineContextMenu(e, tr, record);
      });

      overlays.push(polyline);
    }
    tr._overlays = overlays;
    const shouldShow = isUserDeselectedAll ? false : (selectedYears.size === 0 || selectedYears.has(year));
    if (!shouldShow) overlays.forEach(o => {
      try {
        if (currentMapType === 'amap') { try { amapInstance.remove(o); } catch (_) { } }
        else if (currentMapType === 'google') { if (o.setMap) o.setMap(null); }
        else if (currentMapType === 'leaflet') { try { leafletMap.removeLayer(o); } catch (_) { } }
      } catch (_) { }
    });
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
      < td ></td > < !--Seq # updated later-- >
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
        const route = `${rec.startCity || ''}${rec.startStation} → ${rec.endCity || ''}${rec.endStation} `;
        console.error(`重绘路径失败[${route}]: `, error.message);
      }
    }
  }
  updateYearLegend();
}

function forceRedrawAllPaths() {
  if (!confirm('确定要重新生成所有线路？\n这将清除已缓存的路径与坐标并重新请求。')) return;
  redrawAllPaths(true);
}

console.log('[Geocoding Module] ✅ 加载完成');
