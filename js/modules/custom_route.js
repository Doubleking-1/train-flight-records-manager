// ===================================
// 自定义线路展示模块 (Custom Route Viewer)
// ===================================
//
// 勾选路线 → 立即在地图上显示；取消勾选 → 立即移除
// 依赖 app.js 中的全局变量：
// - currentMapType, customRouteMapInstance
// - customRoutePolylines, customRouteAnimationId, customRoutePaused
// - wgs84ToGcj02, isInChina, getYearColor
// - getRawRecords (定义于 replay.js)
// - DARK_MAP_STYLE, LIGHT_MAP_STYLE, API_CONFIG

console.log('[CustomRoute] 加载自定义线路模块');

// 每条路线的 polyline 实例，以 li._rec 的唯一标识为 key
// 用 Map<recKey, polyline> 管理，方便增删
const _crPolylineMap = new Map();

// ===========================================
// 1. 地图管理
// ===========================================

function initCustomRouteMap() {
    if (customRouteMapInstance) return;
    const isDark = document.body.classList.contains('dark');
    const mapDiv = document.getElementById('customRouteMap');
    if (!mapDiv) return;

    if (currentMapType === 'amap') {
        customRouteMapInstance = new AMap.Map('customRouteMap', { viewMode: '2D', zoom: 4, center: [105, 35] });
        try { customRouteMapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE); } catch (e) { }
    } else if (currentMapType === 'google') {
        if (!window.google || !window.google.maps) {
            customRouteMapInstance = new AMap.Map('customRouteMap', { viewMode: '2D', zoom: 4, center: [105, 35] });
            try { customRouteMapInstance.setMapStyle(isDark ? DARK_MAP_STYLE : LIGHT_MAP_STYLE); } catch (e) { }
        } else {
            const styles = API_CONFIG.getGoogleMapOptions(isDark).styles;
            customRouteMapInstance = new google.maps.Map(mapDiv, {
                zoom: 4, center: { lat: 35, lng: 105 },
                mapTypeId: google.maps.MapTypeId.ROADMAP, styles
            });
        }
    } else if (currentMapType === 'leaflet') {
        customRouteMapInstance = L.map('customRouteMap', { center: [35, 105], zoom: 4, scrollWheelZoom: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd', maxZoom: 20
        }).addTo(customRouteMapInstance);
        if (isDark) {
            try { customRouteMapInstance.getContainer().style.filter = 'invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%)'; } catch (e) { }
        }
    }
}

/** 从地图移除单条路线的 polyline */
function _crRemovePolyline(key) {
    const p = _crPolylineMap.get(key);
    if (!p) return;
    try {
        if (currentMapType === 'amap') p.setMap(null);
        else if (currentMapType === 'google') p.setMap(null);
        else if (currentMapType === 'leaflet') p.remove();
    } catch (e) { }
    _crPolylineMap.delete(key);
}

/** 清除地图上所有自定义路线 */
function clearCustomRouteMapOverlays() {
    _crPolylineMap.forEach((_, key) => _crRemovePolyline(key));
    _crPolylineMap.clear();
    customRoutePolylines = [];
    try {
        if (currentMapType === 'amap' && customRouteMapInstance) customRouteMapInstance.clearMap();
    } catch (e) { }
}

// ===========================================
// 2. 绘制 / 移除单条路线（勾选响应）
// ===========================================

function _crRecKey(rec) {
    return `${rec._entityType}|${rec.date}|${rec.trainNo}|${rec.startStation}|${rec.endStation}`;
}

/** 在地图上绘制一条路线（完整路径，立即显示） */
function _crDrawRoute(rec) {
    const key = _crRecKey(rec);
    if (_crPolylineMap.has(key)) return; // 已绘制

    const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';
    const year = rec.date ? rec.date.substring(0, 4) : '';
    const strokeColor = source === 'all'
        ? (rec._entityType === 'plane' ? '#2196F3' : '#F44336')
        : getYearColor(year);
    const lineWidth = window.mapLineWidth || 2;

    try {
        let polyline = null;

        if (currentMapType === 'amap') {
            let gcjPath = rec.pathGCJ;
            if (!gcjPath || !gcjPath.length) {
                gcjPath = rec.pathWGS.map(p => isInChina(p[0], p[1]) ? wgs84ToGcj02(p[0], p[1]) : p);
            }
            polyline = new AMap.Polyline({ path: gcjPath, strokeColor, strokeWeight: lineWidth, strokeOpacity: (window.mapLineOpacity || 0.9) });
            customRouteMapInstance.add(polyline);

        } else if (currentMapType === 'google') {
            const googlePath = rec.pathWGS.map(p => ({ lat: p[1], lng: p[0] }));
            polyline = new google.maps.Polyline({ path: googlePath, geodesic: false, strokeColor, strokeOpacity: (window.mapLineOpacity || 0.9), strokeWeight: lineWidth });
            polyline.setMap(customRouteMapInstance);

        } else if (currentMapType === 'leaflet') {
            const leafletPath = rec.pathWGS.map(p => [p[1], p[0]]);
            polyline = L.polyline(leafletPath, { color: strokeColor, weight: lineWidth, opacity: (window.mapLineOpacity || 0.9) }).addTo(customRouteMapInstance);
        }

        if (polyline) {
            _crPolylineMap.set(key, polyline);
            customRoutePolylines = Array.from(_crPolylineMap.values());
        }
    } catch (e) {
        console.warn('[CustomRoute] 绘制路线失败:', e);
    }
}

/** 缩放地图以包含所有已绘制路线 */
function _crFitAll() {
    if (!customRouteMapInstance || _crPolylineMap.size === 0) return;
    try {
        if (currentMapType === 'amap') {
            customRouteMapInstance.setFitView(Array.from(_crPolylineMap.values()));
        } else if (currentMapType === 'google') {
            const bounds = new google.maps.LatLngBounds();
            _crPolylineMap.forEach(p => {
                p.getPath().forEach(pt => bounds.extend(pt));
            });
            customRouteMapInstance.fitBounds(bounds);
        } else if (currentMapType === 'leaflet') {
            const group = L.featureGroup(Array.from(_crPolylineMap.values()));
            customRouteMapInstance.fitBounds(group.getBounds(), { padding: [20, 20] });
        }
    } catch (e) { }
}

// ===========================================
// 3. 路线列表构建
// ===========================================

function _crGetFilteredRecords() {
    const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';
    const year = document.getElementById('customRouteYearFilter')?.value || '';
    const startCity = document.getElementById('customRouteStartCityFilter')?.value || '';
    const endCity = document.getElementById('customRouteEndCityFilter')?.value || '';
    const q = (document.getElementById('customRouteSearch')?.value || '').trim().toLowerCase();
    let raw = getRawRecords(source).filter(r => Array.isArray(r.pathWGS) && r.pathWGS.length > 1);
    if (year) raw = raw.filter(r => r.date && r.date.substring(0, 4) === year);
    if (startCity) raw = raw.filter(r => r.startCity === startCity);
    if (endCity) raw = raw.filter(r => r.endCity === endCity);
    if (q) raw = raw.filter(r =>
        [r.startStation, r.startCity, r.endStation, r.endCity, r.trainNo, r.date].join(' ').toLowerCase().includes(q)
    );
    return raw;
}

function buildCustomRouteYearOptions() {
    const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';
    const raw = getRawRecords(source);
    const years = [...new Set(raw.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort();
    const sel = document.getElementById('customRouteYearFilter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部年份</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
    sel.value = years.includes(cur) ? cur : '';
}

function buildCustomRouteCityOptions() {
    const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';
    const raw = getRawRecords(source).filter(r => Array.isArray(r.pathWGS) && r.pathWGS.length > 1);

    const startCities = [...new Set(raw.map(r => r.startCity).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const endCities = [...new Set(raw.map(r => r.endCity).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const startSel = document.getElementById('customRouteStartCityFilter');
    const endSel = document.getElementById('customRouteEndCityFilter');

    if (startSel) {
        const cur = startSel.value;
        startSel.innerHTML = '<option value="">全部城市</option>' + startCities.map(c => `<option value="${c}">${c}</option>`).join('');
        startSel.value = startCities.includes(cur) ? cur : '';
    }
    if (endSel) {
        const cur = endSel.value;
        endSel.innerHTML = '<option value="">全部城市</option>' + endCities.map(c => `<option value="${c}">${c}</option>`).join('');
        endSel.value = endCities.includes(cur) ? cur : '';
    }
}

function buildCustomRouteList() {
    const ul = document.getElementById('customRouteList');
    if (!ul) return;
    const recs = _crGetFilteredRecords();
    ul.innerHTML = '';

    if (!recs.length) {
        ul.innerHTML = '<li style="padding:12px; color:var(--text-color); opacity:.6; text-align:center;">无可显示路线<br><small>请先在主页绘制线路缓存路径</small></li>';
        _updateStatusCount();
        return;
    }

    const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';

    recs.forEach(rec => {
        const key = _crRecKey(rec);
        const year = rec.date ? rec.date.substring(0, 4) : '';
        const dotColor = source === 'all'
            ? (rec._entityType === 'plane' ? '#2196F3' : '#F44336')
            : getYearColor(year);

        const li = document.createElement('li');
        li.style.cssText = 'padding:6px 10px; border-bottom:1px solid var(--border-color); display:flex; align-items:flex-start; gap:8px; cursor:pointer;';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.cssText = 'margin-top:3px; cursor:pointer; flex-shrink:0;';
        // Restore checked state if this route is already drawn
        cb.checked = _crPolylineMap.has(key);

        cb.addEventListener('change', () => {
            if (cb.checked) {
                _crDrawRoute(rec);
                // Pan to this route
                try {
                    if (rec.pathWGS && rec.pathWGS.length) {
                        const mid = rec.pathWGS[Math.floor(rec.pathWGS.length / 2)];
                        const dist = parseFloat(rec.distance) || 0;
                        const z = dist < 50 ? 10 : dist < 100 ? 9 : dist < 200 ? 8 : dist < 800 ? 6 : 5;
                        if (currentMapType === 'amap') {
                            customRouteMapInstance.setZoomAndCenter(z, _crPolylineMap.get(key)?.getPath?.()[Math.floor((rec.pathWGS.length) / 2)] || [mid[0], mid[1]]);
                        } else if (currentMapType === 'google') {
                            customRouteMapInstance.setZoom(z);
                            customRouteMapInstance.setCenter({ lat: mid[1], lng: mid[0] });
                        } else if (currentMapType === 'leaflet') {
                            customRouteMapInstance.setView([mid[1], mid[0]], z);
                        }
                    }
                } catch (e) { }
            } else {
                _crRemovePolyline(key);
                customRoutePolylines = Array.from(_crPolylineMap.values());
            }
            _updateStatusCount();
        });

        const colorDot = document.createElement('div');
        colorDot.style.cssText = `width:8px; height:8px; border-radius:50%; background:${dotColor}; flex-shrink:0; margin-top:5px;`;

        const info = document.createElement('div');
        info.style.cssText = 'flex:1; min-width:0;';
        const startS = rec.startStation || '?';
        const startC = rec.startCity ? `(${rec.startCity})` : '';
        const endS = rec.endStation || '?';
        const endC = rec.endCity ? `(${rec.endCity})` : '';
        const icon = rec._entityType === 'plane' ? '✈️' : '🚆';
        const details = [];
        if (rec.date) details.push(rec.date);
        if (rec.distance) details.push(`${rec.distance}km`);
        if (rec.trainNo) details.push(rec.trainNo);

        info.innerHTML = `
      <div style="font-size:11px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${icon} ${startS}${startC} → ${endS}${endC}</div>
      <div style="font-size:10px; color:var(--text-secondary); margin-top:1px;">${details.join(' · ')}</div>
    `;

        // Click anywhere on row toggles checkbox
        li.addEventListener('click', e => {
            if (e.target === cb) return;
            cb.checked = !cb.checked;
            cb.dispatchEvent(new Event('change'));
        });

        li._rec = rec;
        li.appendChild(cb);
        li.appendChild(colorDot);
        li.appendChild(info);
        ul.appendChild(li);
    });

    _updateStatusCount();
}

function _updateStatusCount() {
    const cnt = _crPolylineMap.size;
    const el = document.getElementById('customRouteSelectedCount');
    if (el) el.textContent = `已显示 ${cnt} 条`;
    const statusEl = document.getElementById('customRouteStatus');
    if (statusEl) statusEl.textContent = cnt > 0 ? `地图上显示了 ${cnt} 条路线` : '准备就绪';

    // Stats panel
    const statsPanel = document.getElementById('customRouteStatsPanel');
    const statsContent = document.getElementById('customRouteStatsContent');
    if (!statsPanel || !statsContent) return;

    if (cnt === 0) {
        statsPanel.style.display = 'none';
        return;
    }

    // Gather selected records from the list
    const selectedRecs = [];
    document.querySelectorAll('#customRouteList li').forEach(li => {
        if (!li._rec) return;
        const cb = li.querySelector('input[type="checkbox"]');
        if (cb && cb.checked) selectedRecs.push(li._rec);
    });

    // Compute stats
    let totalDist = 0;
    let totalMinutes = 0;
    let totalCost = 0;
    const cities = new Set();
    let trainCount = 0;
    let planeCount = 0;

    selectedRecs.forEach(r => {
        totalDist += (parseFloat(r.distance) || 0);
        totalMinutes += parseDurationToMinutes(r.duration);
        totalCost += (parseFloat(r.cost) || 0);
        if (r.startCity) cities.add(r.startCity);
        if (r.endCity) cities.add(r.endCity);
        if (r._entityType === 'plane') planeCount++;
        else trainCount++;
    });

    // Format distance
    let distStr;
    if (totalDist >= 10000) distStr = (totalDist / 10000).toFixed(2) + ' 万km';
    else distStr = Math.round(totalDist).toLocaleString() + ' km';

    // Format duration
    let durStr;
    if (totalMinutes >= 60) {
        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        durStr = `${h}h ${m}m`;
    } else {
        durStr = `${Math.round(totalMinutes)}m`;
    }

    // Build HTML
    const lines = [];
    lines.push(`<div style="display:flex; justify-content:space-between;"><span>🚦 趟次</span><b>${cnt}</b></div>`);
    if (trainCount > 0 && planeCount > 0) {
        lines.push(`<div style="display:flex; justify-content:space-between; opacity:.8;"><span>　🚆 火车</span><span>${trainCount}</span></div>`);
        lines.push(`<div style="display:flex; justify-content:space-between; opacity:.8;"><span>　✈️ 飞机</span><span>${planeCount}</span></div>`);
    }
    lines.push(`<div style="display:flex; justify-content:space-between;"><span>📏 总里程</span><b>${distStr}</b></div>`);
    lines.push(`<div style="display:flex; justify-content:space-between;"><span>⏱ 总时长</span><b>${durStr}</b></div>`);
    if (totalCost > 0) {
        lines.push(`<div style="display:flex; justify-content:space-between;"><span>💰 总费用</span><b>¥${totalCost.toFixed(0)}</b></div>`);
    }
    lines.push(`<div style="display:flex; justify-content:space-between;"><span>🏙 到访城市</span><b>${cities.size}</b></div>`);

    statsContent.innerHTML = lines.join('');
    statsPanel.style.display = 'block';
}

// ===========================================
// 4. 事件绑定
// ===========================================

(function bindCustomRouteEvents() {
    const overlay = document.getElementById('customRouteOverlay');
    const openBtn = document.getElementById('customRouteBtn');
    const closeBtn = document.getElementById('customRouteCloseBtn');
    const selectAllBtn = document.getElementById('customRouteSelectAllBtn');
    const clearSelBtn = document.getElementById('customRouteClearBtn');
    const clearMapBtn = document.getElementById('customRouteClearMapBtn');
    const searchInput = document.getElementById('customRouteSearch');
    const yearFilter = document.getElementById('customRouteYearFilter');
    const startCityFilter = document.getElementById('customRouteStartCityFilter');
    const endCityFilter = document.getElementById('customRouteEndCityFilter');
    const colorLegend = document.getElementById('customRouteColorLegend');

    if (!overlay || !openBtn) {
        console.warn('[CustomRoute] 关键元素缺失，跳过事件绑定');
        return;
    }

    // Open
    openBtn.addEventListener('click', () => {
        overlay.style.display = 'flex';

        // Re-create map if needed (match current map type)
        if (customRouteMapInstance) {
            try {
                if (currentMapType === 'amap' && customRouteMapInstance.destroy) customRouteMapInstance.destroy();
                else if (currentMapType === 'google') document.getElementById('customRouteMap').innerHTML = '';
                else if (currentMapType === 'leaflet' && customRouteMapInstance.remove) customRouteMapInstance.remove();
            } catch (e) { }
            customRouteMapInstance = null;
            _crPolylineMap.clear();
            customRoutePolylines = [];
        }

        initCustomRouteMap();
        buildCustomRouteYearOptions();
        buildCustomRouteCityOptions();

        // Default source = current entity
        const srcRadio = document.querySelector(`input[name="customRouteSource"][value="${currentEntity}"]`)
            || document.querySelector('input[name="customRouteSource"][value="all"]');
        if (srcRadio) srcRadio.checked = true;

        const source = document.querySelector('input[name="customRouteSource"]:checked')?.value || 'all';
        if (colorLegend) colorLegend.style.display = source === 'all' ? 'block' : 'none';

        buildCustomRouteYearOptions();
        buildCustomRouteCityOptions();
        buildCustomRouteList();

        // Keyboard shortcuts removed (Handled by global listener in app.js)

    });

    // Close
    closeBtn.addEventListener('click', () => {
        overlay.style.display = 'none';
        clearCustomRouteMapOverlays();
        if (window._customRouteKeyHandler) {
            window.removeEventListener('keydown', window._customRouteKeyHandler);
            delete window._customRouteKeyHandler;
        }

    });

    // Source radio
    document.querySelectorAll('input[name="customRouteSource"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (colorLegend) colorLegend.style.display = radio.value === 'all' ? 'block' : 'none';
            // Clear map when source changes (colors and paths may differ)
            clearCustomRouteMapOverlays();
            buildCustomRouteYearOptions();
            buildCustomRouteCityOptions();
            buildCustomRouteList();
        });
    });

    // Year filter
    if (yearFilter) yearFilter.addEventListener('change', buildCustomRouteList);

    // City filters
    if (startCityFilter) startCityFilter.addEventListener('change', buildCustomRouteList);
    if (endCityFilter) endCityFilter.addEventListener('change', buildCustomRouteList);

    // Search
    if (searchInput) searchInput.addEventListener('input', buildCustomRouteList);

    // Select all → draw all visible routes
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            document.querySelectorAll('#customRouteList li[data-idx], #customRouteList li').forEach(li => {
                if (!li._rec) return;
                const cb = li.querySelector('input[type="checkbox"]');
                if (cb && !cb.checked) {
                    cb.checked = true;
                    _crDrawRoute(li._rec);
                }
            });
            _updateStatusCount();
            // Fit map to show everything
            setTimeout(_crFitAll, 100);
        });
    }

    // Clear selection → remove all from map
    if (clearSelBtn) {
        clearSelBtn.addEventListener('click', () => {
            document.querySelectorAll('#customRouteList input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });
            clearCustomRouteMapOverlays();
            _updateStatusCount();
        });
    }

    // Clear map button
    if (clearMapBtn) {
        clearMapBtn.addEventListener('click', () => {
            clearCustomRouteMapOverlays();
            // Uncheck all checkboxes in list
            document.querySelectorAll('#customRouteList input[type="checkbox"]').forEach(cb => cb.checked = false);
            _updateStatusCount();
        });
    }

    console.log('[CustomRoute] 事件绑定完成');
})();

console.log('[CustomRoute] 自定义线路模块加载完成');
