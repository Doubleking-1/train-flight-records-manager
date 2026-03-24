// ===================================
// 表格行内编辑模块 (Table Editor Module)
// ===================================
//
// 负责表格行的修改、保存、插入
// 依赖全局: records, tbody, COL, getEntityConfig(), parseDurationToMinutes(),
//           currentMapType, amapInstance, saveRecords(), updateYearLegend(), 
//           updateStats(), updateSequenceNumbers(), drawPath(), attachRowEvents(),
//           readDurationFromRowCell(), buildDurationSelects()

console.log('[Table Editor Module] 加载中...');

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
  durationCell.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateRowCalculations));

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
  durationCell.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateRowCalculations));

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

function insertInlineAtTop() {
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
  
  if (tbody.firstChild) {
    tbody.insertBefore(newTr, tbody.firstChild);
  } else {
    tbody.appendChild(newTr);
  }
  newTr._isNewRow = true;
  updateSequenceNumbers();

  const c = newTr.cells;
  const updateRowCalculations = () => {
    const cost = parseFloat(c[COL.cost].querySelector('input').value) || 0;
    const dist = parseFloat(c[COL.distance].querySelector('input').value) || 0;
    c[COL.rmbPerKm].textContent = dist > 0 ? (cost / dist).toFixed(4) : '';

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
  const durationCell = c[COL.duration];
  durationCell.querySelectorAll('input').forEach(inp => inp.addEventListener('input', updateRowCalculations));

  c[COL.actions].querySelector('.save').addEventListener('click', () => {
    const rec = collectRowData(newTr);
    if (!rec.startStation || !rec.endStation) {
      const cfg = getEntityConfig();
      alert(`${cfg.labels.startStation} 和 ${cfg.labels.endStation} 不能为空！`);
      return;
    }
    renderRowFromData(newTr, rec);
    updateSequenceNumbers();
    
    const idx = Array.from(tbody.children).indexOf(newTr);
    if (idx !== -1) {
      records.splice(idx, 0, { ...rec });
      saveRecords();
    }
    
    try { drawPath(newTr, records[idx]); } catch (e) { console.warn('绘制新增线路失败', e); }
    try { updateYearLegend && updateYearLegend(); } catch { }
    try { updateStats && updateStats(); } catch { }
  });

  c[COL.actions].querySelector('.cancel').addEventListener('click', () => {
    newTr.remove();
    updateSequenceNumbers();
  });
}
console.log('[Table Editor Module] ✅ 加载完成');
