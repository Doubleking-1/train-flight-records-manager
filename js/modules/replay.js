// ===================================
// 动画回放模块 - 阶段2：核心动画函数
// ===================================
// 
// 此模块包含动画回放的核心函数
// 依赖 app.js 中的全局变量：
// - currentMapType, replayMapInstance  
// - wgs84ToGcj02, isInChina, parseDurationToMinutes
// - replayTimer, replayIndex, replayRecords, replayPaused
// - replayAnimationId, replayPolylines, replayCurrentMarker
// - replayYearProgressBar, replayYearProgressCnt, replayYearProgressTotal
// - replayCurrentRouteBox, replayRouteList
// - replaySpeedInput, replayWidthInput
// - replayStatusSpan, replayProgressSpan
// - replayYearTotal, replayYearDone, replayCurrentYear
// - sequentialYears, sequentialPointer, isSequentialMode

console.log('[Replay Module] 加载阶段2 - 核心动画函数');

// ===========================================
// 1. 平滑缩放过渡函数 (Smooth Zoom Transition)
// ===========================================

function performSmoothZoomTransition(targetPoint, onComplete) {
  const ZOOM_OUT_LEVEL = 4;  // Zoom out to wide view
  const ZOOM_OUT_DELAY = 100;  // Minimal delay after zoom out (ms)
  const ZOOM_OUT_DURATION = 800; // Zoom out animation duration (ms)

  try {
    if (currentMapType === 'amap') {
      // Zoom out with animation
      replayMapInstance.setZoom(ZOOM_OUT_LEVEL, false, ZOOM_OUT_DURATION); // false = animated

      setTimeout(() => {
        // Zoom in will be handled by adaptive zoom in drawReplayOne
        onComplete();
      }, ZOOM_OUT_DURATION + ZOOM_OUT_DELAY);

    } else if (currentMapType === 'google') {
      // Google Maps - has default smooth animation
      replayMapInstance.setZoom(ZOOM_OUT_LEVEL);

      setTimeout(() => {
        onComplete();
      }, ZOOM_OUT_DURATION + ZOOM_OUT_DELAY);

    } else if (currentMapType === 'leaflet') {
      // Leaflet with animation
      replayMapInstance.setZoom(ZOOM_OUT_LEVEL, { animate: true, duration: ZOOM_OUT_DURATION / 1000 });

      setTimeout(() => {
        onComplete();
      }, ZOOM_OUT_DURATION + ZOOM_OUT_DELAY);
    }
  } catch (e) {
    console.error('Smooth zoom transition failed:', e);
    onComplete();
  }
}

console.log('[Replay Module] performSmoothZoomTransition 已加载');

// ===========================================
// 2. 折线动画绘制函数 (Animate Polyline)
// ===========================================

function animatePolyline(polyline, fullPath, onComplete) {
  let pointIndex = 0;
  const totalPoints = fullPath.length;
  // 用户诉求：线短的播快点（完成时间短），线长的播慢点（完成时间长）
  // 之前的逻辑是：所有线都固定在大约 180 帧 (3秒) 播完，导致距离越长，看着速度越“快”。
  // 现在的逻辑：根据路线总长度设定一个基准的“每帧点数”，路线越长花费的时间自然就越长。
  // 基准值：假设正常情况下每次画 1 个点（极短线），如果点数非常多（如 3000 点），为了不至于播几分钟，适当增加每帧点数。
  let speedVal = 30; // 默认值
  if (replaySpeedInput) speedVal = parseInt(replaySpeedInput.value, 10) || 30;

  // speedVal 范围 10~100，30 为正常速度 (1.0x)
  // 如果是正常速度(30)，我们设定长度为 1000 个点的路线，每帧画 5 个点（约需 200 帧 = 3.3秒）。
  // 也就是说基准速率约为：总点数 / 200，但不低于 1。
  let basePointsPerFrame = Math.max(1, Math.ceil(totalPoints / 200));

  // 结合速度滑块调节：
  // 如果滑块在最大(100)，速度大概是正常(30)的 3.3 倍。
  const multiplier = speedVal / 30;

  // 短线保障：如果是极短的线（比如只有几十个点），基准算出来是1。
  // 为了让短线“播快点”，我们强制增加一些基础点数
  if (totalPoints < 100) {
    basePointsPerFrame = 2; // 短线最低每帧 2 个点，会比较快播完
  }

  const pointsPerFrame = Math.max(1, Math.ceil(basePointsPerFrame * multiplier));

  function step() {
    if (replayPaused) {
      // Stop animation loop if paused
      return;
    }
    if (!replayMapInstance) return;

    // Batch frame updates to improve performance (update map once per frame instead of per point)
    const pointsToAdd = [];
    for (let i = 0; i < pointsPerFrame; i++) {
      if (pointIndex < totalPoints) {
        pointsToAdd.push(fullPath[pointIndex]);
        pointIndex++;
      }
    }

    if (pointsToAdd.length > 0) {
      if (currentMapType === 'amap') {
        // Optimization: Use AMap's internal path array if accessible, or update less frequently
        // To avoid O(N^2) copying, we can just push to a local array and set it
        // However, setting the whole array is still O(N).
        // Best approach for AMap 2.0: re-assigning is fast enough for <10000 points, 
        // but we can chunk the polyline if it gets too long.
        // For now, let's keep it simple but ensure we only call setPath ONCE per batch.
        const currentPath = polyline.getPath();
        pointsToAdd.forEach(p => currentPath.push(p));
        polyline.setPath(currentPath);
      } else if (currentMapType === 'google') {
        // Optimization: Google Maps MVCArray.push is O(1)
        const pathMVC = polyline.getPath();
        pointsToAdd.forEach(p => pathMVC.push(p));
      } else if (currentMapType === 'leaflet') {
        // Optimization: Leaflet's addLatLng is O(1) and much faster than setLatLngs(entireArray)
        pointsToAdd.forEach(p => polyline.addLatLng(p));
      }
    }

    // --- Performance Optimization: Throttle Panning ---
    // Throttle panTo requests to max once every 300ms to avoid jitter and frame drops
    const now = performance.now();
    if (!polyline._lastPanTime) polyline._lastPanTime = 0;
    const canPan = (now - polyline._lastPanTime) > 300;

    // Map Center Follow: Move map center to the head of the drawing line (Smart Follow / Deadzone)
    const followCheckbox = document.getElementById('replayMapFollowCheckbox');
    if (pointIndex > 0 && followCheckbox && followCheckbox.checked && canPan) {
      const lastP = fullPath[Math.min(pointIndex - 1, totalPoints - 1)];
      try {
        let shouldPan = false;
        const marginRatio = 0.15; // 15% margin from edges

        if (currentMapType === 'amap') {
          // AMap: Use pixel coordinates for accurate screen bounds check
          const pixel = replayMapInstance.lngLatToContainer(lastP);
          const size = replayMapInstance.getSize();
          if (pixel.x < size.width * marginRatio || pixel.x > size.width * (1 - marginRatio) ||
            pixel.y < size.height * marginRatio || pixel.y > size.height * (1 - marginRatio)) {
            shouldPan = true; // Use panTo for smooth animation
            replayMapInstance.panTo(lastP);
          }
        } else if (currentMapType === 'leaflet') {
          // Leaflet: Use pixel coordinates
          const pixel = replayMapInstance.latLngToContainerPoint(lastP);
          const size = replayMapInstance.getSize();
          if (pixel.x < size.x * marginRatio || pixel.x > size.x * (1 - marginRatio) ||
            pixel.y < size.y * marginRatio || pixel.y > size.y * (1 - marginRatio)) {
            shouldPan = true;
            replayMapInstance.panTo(lastP, { animate: true, duration: 0.5 });
          }
        } else if (currentMapType === 'google') {
          // Google: Use logic based on Bounds (approximate) to avoid complex OverlayView
          const bounds = replayMapInstance.getBounds();
          if (bounds) {
            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const latSpan = ne.lat() - sw.lat();
            const lngSpan = ne.lng() - sw.lng();
            // Check if point is outside the safe inner box
            // Note: This logic is simplified and assumes standard projection
            const lat = typeof lastP.lat === 'function' ? lastP.lat() : lastP.lat;
            const lng = typeof lastP.lng === 'function' ? lastP.lng() : lastP.lng;

            if (lat > ne.lat() - latSpan * marginRatio || lat < sw.lat() + latSpan * marginRatio ||
              lng > ne.lng() - lngSpan * marginRatio || lng < sw.lng() + lngSpan * marginRatio) {
              shouldPan = true;
              replayMapInstance.panTo(lastP);
            }
          } else {
            replayMapInstance.setCenter(lastP); // Fallback if bounds valid yet
          }
        }

        if (shouldPan) {
          polyline._lastPanTime = now;
        }

        // No "else": If inside deadzone, do nothing (keep map static)
      } catch (e) {
        // Ignore errors during fast switching or map disposal
        console.table(e);
      }
    }

    // --- Performance Optimization: Throttle Marker Updates ---
    // Update marker position slightly less frequently if moving very fast, 
    // or batch it, but updating every frame is usually okay for just one marker.
    // We'll keep it per-frame for smoothness, but only if the point actually changed.
    if (replayCurrentMarker && pointIndex > 0) {
      const lastP = fullPath[Math.min(pointIndex - 1, totalPoints - 1)];
      try {
        if (currentMapType === 'amap') {
          replayCurrentMarker.setPosition(lastP);
        } else if (currentMapType === 'google') {
          replayCurrentMarker.setPosition(lastP);
        } else if (currentMapType === 'leaflet') {
          replayCurrentMarker.setLatLng(lastP);
        }
      } catch (e) { }
    }

    if (pointIndex < totalPoints) {
      replayAnimationId = requestAnimationFrame(step);
    } else {
      onComplete && onComplete();
    }
  }
  step();
}

console.log('[Replay Module] animatePolyline 已加载');

// ===========================================
// 3. 单条路线绘制函数 (Draw Replay One)
// ===========================================

function drawReplayOne() {
  if (replayPaused) return; // Should not happen if logic checks pause before calling

  if (replayIndex >= replayRecords.length) {
    replayStatusSpan.textContent = '完成';
    replayTimer = null; // Mark as done

    // 播放结束后缩小到 level 4，提供整体视野
    try {
      if (currentMapType === 'amap') {
        replayMapInstance.setZoom(4, false, 1500); // 1.5秒平滑缩放
      } else if (currentMapType === 'google') {
        replayMapInstance.setZoom(4);
      } else if (currentMapType === 'leaflet') {
        replayMapInstance.setZoom(4, { animate: true, duration: 1.5 });
      }
    } catch (e) {
      console.error('Failed to zoom out after replay completion:', e);
    }

    // 如果是逐年模式，进入下一年
    if (isSequentialMode) {
      setTimeout(() => proceedNextSequentialYear(), 500);
    }
    return;
  }
  const rec = replayRecords[replayIndex];
  const year = rec.date ? rec.date.substring(0, 4) : '';
  const month = rec.date ? rec.date.substring(5, 7) : '';

  // Update date display
  const replayDateDisplay = document.getElementById('replayDateDisplay');
  const replayDateText = document.getElementById('replayDateText');
  if (replayDateDisplay && replayDateText && rec.date) {
    replayDateDisplay.style.display = 'block';
    replayDateText.textContent = `${year}年${month}月`;
  }

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
    li.style.flexDirection = 'column';
    li.style.alignItems = 'flex-start';

    const startStation = rec.startStation || '?';
    const startCity = rec.startCity || '';
    const endStation = rec.endStation || '?';
    const endCity = rec.endCity || '';

    // First line: Station(City) -> Station(City)
    const line1 = `${startStation}${startCity ? `(${startCity})` : ''} → ${endStation}${endCity ? `(${endCity})` : ''}`;

    // Second line: Distance Duration TrainNo(TrainType)
    const details = [];
    if (rec.distance) {
      details.push(`${rec.distance}km`);
    }
    if (rec.duration) {
      const minutes = parseDurationToMinutes(rec.duration);
      const hours = (minutes / 60).toFixed(1);
      details.push(`${hours}h`);
    }
    const trainInfo = [];
    if (rec.trainNo) trainInfo.push(rec.trainNo);
    if (rec.trainType) trainInfo.push(`(${rec.trainType})`);
    if (trainInfo.length > 0) {
      details.push(trainInfo.join(''));
    }

    li.innerHTML = `
      <div style="font-weight:500;">${line1}</div>
      <div style="font-size:0.85em; color:var(--text-secondary); display:flex; gap:12px;">
        ${details.map(d => `<span>${d}</span>`).join('')}
      </div>
    `;
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

      // Adaptive Zoom: detailed view for short routes
      const followCheckbox = document.getElementById('replayMapFollowCheckbox');
      if (followCheckbox && followCheckbox.checked && fullPath.length > 0) {
        const dist = parseFloat(rec.distance) || 0;
        let targetZoom = null;
        if (dist > 0 && dist < 50) targetZoom = 10;        // 极短途：最大放大
        else if (dist > 0 && dist < 100) targetZoom = 9;  // 很短途：进一步放大
        else if (dist > 0 && dist < 200) targetZoom = 8;  // 短途：大放大
        else if (dist > 0 && dist < 800) targetZoom = 6;  // 中途：中等放大
        else targetZoom = 5;                               // 长途：轻微放大

        try {
          // Calculate zoom level difference
          const currentZoom = replayMapInstance.getZoom();
          const zoomDiff = Math.abs(targetZoom - currentZoom);
          // Dynamic duration: 1000ms base + 1500ms per zoom level
          const zoomInDuration = 1000 + (zoomDiff * 1500);

          // Slower zoom-in animation for smooth transition
          replayMapInstance.setCenter(fullPath[0]);
          replayMapInstance.setZoom(targetZoom, false, zoomInDuration);
        } catch (e) { }
      }

      // Start with empty path
      polyline = new AMap.Polyline({ path: [], strokeColor, strokeWeight: lineWidth, strokeOpacity: 0.9 });
      replayMapInstance.add(polyline);
      // Ensure we fill the array slot correctly
      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;

    } else if (currentMapType === 'google') {
      const googlePath = rec.pathWGS.map(p => ({ lat: p[1], lng: p[0] }));
      fullPath = googlePath;

      // Adaptive Zoom (Google)
      const followCheckbox = document.getElementById('replayMapFollowCheckbox');
      if (followCheckbox && followCheckbox.checked && fullPath.length > 0) {
        const dist = parseFloat(rec.distance) || 0;
        let targetZoom = null;
        if (dist > 0 && dist < 50) targetZoom = 10;        // 极短途：最大放大
        else if (dist > 0 && dist < 100) targetZoom = 9;  // 很短途：进一步放大
        else if (dist > 0 && dist < 200) targetZoom = 8;  // 短途：大放大
        else if (dist > 0 && dist < 800) targetZoom = 6;  // 中途：中等放大
        else targetZoom = 5;                               // 长途：轻微放大

        try {
          // Calculate zoom level difference
          const currentZoom = replayMapInstance.getZoom();
          const zoomDiff = Math.abs(targetZoom - currentZoom);
          // Dynamic duration: 1000ms base + 1500ms per zoom level
          const zoomInDuration = 1000 + (zoomDiff * 1500);

          // Slower zoom-in for smooth transition
          const pt = (Array.isArray(fullPath[0])) ?
            { lat: fullPath[0][1], lng: fullPath[0][0] } : fullPath[0];
          replayMapInstance.panTo(pt);

          // Google Maps doesn't support duration parameter, but we can delay
          // to give the illusion of slower zoom
          setTimeout(() => {
            replayMapInstance.setZoom(targetZoom);
          }, Math.min(300, zoomInDuration / 3)); // Slight delay proportional to zoom
        } catch (e) { }
      }

      // Start with empty path
      polyline = new google.maps.Polyline({ path: [], geodesic: false, strokeColor, strokeOpacity: 0.9, strokeWeight: lineWidth });
      polyline.setMap(replayMapInstance);

      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;
    } else if (currentMapType === 'leaflet') {
      const leafletPath = rec.pathWGS.map(p => [p[1], p[0]]);
      fullPath = leafletPath;

      // Adaptive Zoom (Leaflet)
      const followCheckbox = document.getElementById('replayMapFollowCheckbox');
      if (followCheckbox && followCheckbox.checked && fullPath.length > 0) {
        const dist = parseFloat(rec.distance) || 0;
        let targetZoom = null;
        if (dist > 0 && dist < 50) targetZoom = 10;        // 极短途：最大放大
        else if (dist > 0 && dist < 100) targetZoom = 9;  // 很短途：进一步放大
        else if (dist > 0 && dist < 200) targetZoom = 8;  // 短途：大放大
        else if (dist > 0 && dist < 800) targetZoom = 6;  // 中途：中等放大
        else targetZoom = 5;                               // 长途：轻微放大

        try {
          // Calculate zoom level difference
          const currentZoom = replayMapInstance.getZoom();
          const zoomDiff = Math.abs(targetZoom - currentZoom);
          // Dynamic duration: 1.0s base + 1.5s per zoom level
          const zoomInDuration = 1.0 + (zoomDiff * 1.5);

          // Slower zoom-in animation for smooth transition
          replayMapInstance.setView(fullPath[0], targetZoom, { animate: true, duration: zoomInDuration });
        } catch (e) { }
      }

      // Start with empty path
      polyline = L.polyline([], {
        color: strokeColor,
        weight: lineWidth,
        opacity: 0.9
      }).addTo(replayMapInstance);

      if (replayPolylines.length <= replayIndex) replayPolylines.push(polyline);
      else replayPolylines[replayIndex] = polyline;
    }

    // Create animated marker at the endpoint
    // Remove previous marker if exists
    if (replayCurrentMarker) {
      try {
        if (currentMapType === 'amap') replayCurrentMarker.setMap(null);
        else if (currentMapType === 'google') replayCurrentMarker.setMap(null);
        else if (currentMapType === 'leaflet') replayCurrentMarker.remove();
      } catch (e) { }
      replayCurrentMarker = null;
    }

    // Create new marker based on entity type
    const isPlane = rec._entityType === 'plane';
    const markerIcon = isPlane ? '✈️' : '🚆';

    if (polyline && fullPath.length) {
      try {
        if (currentMapType === 'amap') {
          replayCurrentMarker = new AMap.Marker({
            position: fullPath[0],
            content: `<div style="font-size:24px;">${markerIcon}</div>`,
            offset: new AMap.Pixel(-12, -12)
          });
          replayMapInstance.add(replayCurrentMarker);
        } else if (currentMapType === 'google') {
          replayCurrentMarker = new google.maps.Marker({
            position: fullPath[0],
            map: replayMapInstance,
            label: {
              text: markerIcon,
              fontSize: '24px',
              className: 'marker-label'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0
            }
          });
        } else if (currentMapType === 'leaflet') {
          const markerIconDef = L.divIcon({
            html: `<div style="font-size:24px;">${markerIcon}</div>`,
            className: 'replay-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          replayCurrentMarker = L.marker(fullPath[0], { icon: markerIconDef }).addTo(replayMapInstance);
        }
      } catch (e) {
        console.error('Failed to create marker:', e);
      }
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

        // Pause and smooth pan to next start point
        if (replayIndex < replayRecords.length) {
          // Note: Keep marker visible during pause - it will be replaced when next route starts
          const nextRec = replayRecords[replayIndex];
          // Pre-calculate next start point
          let nextStart = null;
          // Try to get start point from path
          if (nextRec.pathGCJ && nextRec.pathGCJ.length) nextStart = nextRec.pathGCJ[0];
          else if (nextRec.pathWGS && nextRec.pathWGS.length) {
            const p = nextRec.pathWGS[0];
            nextStart = (currentMapType === 'amap' && isInChina(p[0], p[1])) ? wgs84ToGcj02(p[0], p[1]) : p;
          }

          // Calculate distance and duration
          let pauseDuration = 800; // Base pause
          if (nextStart) {
            // Helper to get lat/lng numbers
            const getPt = (pt) => {
              if (Array.isArray(pt)) return { lat: pt[1], lng: pt[0] };
              if (typeof pt.lat === 'function') return { lat: pt.lat(), lng: pt.lng() };
              return pt;
            };

            // Current end point (last of fullPath)
            const lastEnd = fullPath[fullPath.length - 1];

            if (lastEnd) {
              const p1 = getPt(lastEnd);
              const p2 = getPt(nextStart);

              // Simple Haversine (inline to avoid dependency issues)
              const R = 6371;
              const dLat = (p2.lat - p1.lat) * Math.PI / 180;
              const dLon = (p2.lng - p1.lng) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              const d = R * c; // Distance in km

              // Dynamic duration logic - smoother/faster
              if (d > 2000) pauseDuration = 1500;
              else if (d > 500) pauseDuration = 1000;
              else if (d > 100) pauseDuration = 700;
              else pauseDuration = 500;
            }
          }

          // Pan if "Follow" is checked
          const followCheckbox = document.getElementById('replayMapFollowCheckbox');
          if (nextStart && followCheckbox && followCheckbox.checked) {
            // Calculate transition distance (already calculated above as 'd')
            const lastEnd = fullPath[fullPath.length - 1];
            let transitionDistance = 0;

            if (lastEnd) {
              const getPt = (pt) => {
                if (Array.isArray(pt)) return { lat: pt[1], lng: pt[0] };
                if (typeof pt.lat === 'function') return { lat: pt.lat(), lng: pt.lng() };
                return pt;
              };

              const p1 = getPt(lastEnd);
              const p2 = getPt(nextStart);

              const R = 6371;
              const dLat = (p2.lat - p1.lat) * Math.PI / 180;
              const dLon = (p2.lng - p1.lng) * Math.PI / 180;
              const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
              const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
              transitionDistance = R * c;
            }

            // If distance is far (> 500km), use smooth zoom transition
            if (transitionDistance > 500) {
              // Smooth zoom transition: zoom out → pan → zoom in
              performSmoothZoomTransition(nextStart, () => {
                drawReplayOne();
              });
              return; // Exit early, don't use normal setTimeout
            } else {
              // Normal pan for short distances
              try {
                if (currentMapType === 'amap') {
                  replayMapInstance.panTo(nextStart);
                } else if (currentMapType === 'google') {
                  const pt = (currentMapType === 'google' && !Array.isArray(nextStart)) ? nextStart : { lat: nextStart[1], lng: nextStart[0] };
                  replayMapInstance.panTo(pt);
                } else if (currentMapType === 'leaflet') {
                  // Convert ms to s for Leaflet duration
                  replayMapInstance.panTo([nextStart[1], nextStart[0]], { animate: true, duration: pauseDuration / 1000 });
                }
              } catch (e) { }
            }
          }

          // Dynamic Pause
          setTimeout(() => {
            drawReplayOne();
          }, pauseDuration);
        } else {
          // Done
          drawReplayOne();
        }
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

console.log('[Replay Module] drawReplayOne 已加载');

// ===========================================
// 4. 辅助函数 - 获取原始记录 (Get Raw Records)
// ===========================================

function getRawRecords(type) {
  let raw = [];
  if (type === 'train') {
    try {
      raw = JSON.parse(localStorage.getItem('trainRecords')) || [];
      // Tag with entity type for color coding
      raw.forEach(r => r._entityType = 'train');
      // Sort by time
      raw.sort((a, b) => {
        const da = new Date((a.date || '') + ' ' + (a.time || '00:00'));
        const db = new Date((b.date || '') + ' ' + (b.time || '00:00'));
        return da - db;
      });
    } catch (e) { }
  } else if (type === 'plane') {
    try {
      raw = JSON.parse(localStorage.getItem('planeRecords')) || [];
      // Tag with entity type for color coding
      raw.forEach(r => r._entityType = 'plane');
      // Sort by time
      raw.sort((a, b) => {
        const da = new Date((a.date || '') + ' ' + (a.time || '00:00'));
        const db = new Date((b.date || '') + ' ' + (b.time || '00:00'));
        return da - db;
      });
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

console.log('[Replay Module] getRawRecords 已加载');
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

console.log('[Replay Module] initReplayMap 已加载');

// ===========================================
// 5. 数据处理函数 (Data Processing)
// ===========================================

// 构建年份选项
function buildReplayYearOptions() {
  if (!replayYearSelect) return;
  const years = [...new Set(records.filter(r => r.date).map(r => r.date.substring(0, 4)))].sort();
  replayYearSelect.innerHTML = '<option value="">全部</option>' + years.map(y => `<option value="${y}">${y}</option>`).join('');
}

// 收集回放路径
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

console.log('[Replay Module] buildReplayYearOptions & collectReplayPaths 已加载');

// ===========================================
// 6. 控制函数 (Control Functions)
// ===========================================

// 开始回放
function startReplay() {
  if (!replayRecords.length) {
    replayStatusSpan.textContent = '无可回放线路';
    return;
  }
  replayIndex = 0;
  replayPaused = false;
  replayStatusSpan.textContent = '绘制中';
  // Use a dummy timer flag so other logic thinks it's running?
  // Existing logic checks if (replayTimer) clearInterval...
  // Let's keep replayTimer as a simple boolean flag or just not null
  if (replayTimer) clearInterval(replayTimer); // just in case
  replayTimer = {}; // dummy object so it's truthy
  drawReplayOne();
}

// 清除回放地图
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
      replayPolylines.forEach(polyline => {
        if (polyline && polyline.remove) polyline.remove();
      });
      replayPolylines = [];
    }

    // Hide date display
    const replayDateDisplay = document.getElementById('replayDateDisplay');
    if (replayDateDisplay) {
      replayDateDisplay.style.display = 'none';
    }
  } catch (e) {
    console.warn('清除回放地图失败:', e);
  }
}

// 逐年回放：继续下一年
function proceedNextSequentialYear() {
  sequentialPointer++;
  if (sequentialPointer >= sequentialYears.length) {
    // All years done
    replayStatusSpan.textContent = '全部年份已完成';
    isSequentialMode = false;
    replayTimer = null;
    return;
  }
  const nextYear = sequentialYears[sequentialPointer];
  replayStatusSpan.textContent = `正在加载 ${nextYear} 年...`;

  // 清除上一年的绘制
  clearReplayMapOnly();

  // 重新收集该年路径
  collectReplayPaths(nextYear);
  replayProgressSpan.textContent = '0';

  if (!replayRecords.length) {
    replayStatusSpan.textContent = `${nextYear} 无可回放线路，跳过...`;
    setTimeout(() => proceedNextSequentialYear(), 1000);
    return;
  }

  // 继续播放
  replayIndex = 0;
  replayPaused = false;
  drawReplayOne();
}

console.log('[Replay Module] startReplay, clearReplayMapOnly, proceedNextSequentialYear 已加载');
