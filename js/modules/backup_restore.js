// ===================================
// 备份恢复模块 (Backup & Restore Module)
// ===================================
//
// 负责数据备份和恢复
// 依赖全局: records, getEntityConfig(), geocodeCache, saveGeocodeCache(),
//           tbody, addRecordToTable(), syncRecordsFromTable(),
//           updateSequenceNumbers(), updateYearLegend(), updateStats(),
//           redrawAllPaths(), selectedYears, currentEntity, currentMapType,
//           applyEntityUI(), themeToggle

console.log('[Backup Restore Module] 加载中...');

// ===================== 数据备份 =====================

function backupData() {
    try {
        const cfg = getEntityConfig();
        const backupObj = {
            backupDate: new Date().toISOString(),
            version: '1.2',
            recordCount: records.length,
            records: records,
            geocodeCache: geocodeCache,
            customAddresses: window.customAddresses || {},
            settings: {
                currentMapType: currentMapType,
                selectedYears: Array.from(selectedYears),
                theme: document.body.classList.contains('dark') ? 'dark' : 'light',
                entity: currentEntity
            }
        };

        const jsonString = JSON.stringify(backupObj, null, 2);
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

// ===================== 数据恢复 =====================

function restoreData(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const backupObj = JSON.parse(e.target.result);
            const ver = backupObj.version || '1.0';

            if (!backupObj.records || !Array.isArray(backupObj.records)) {
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
            backupObj.records.forEach(record => {
                if (record.pathWGS && !Array.isArray(record.pathWGS)) delete record.pathWGS;
                if (record.pathGCJ && !Array.isArray(record.pathGCJ)) delete record.pathGCJ;
                addRecordToTable(record);
            });

            // 恢复地理编码缓存（1.1+）
            if (ver >= '1.1' && backupObj.geocodeCache && typeof backupObj.geocodeCache === 'object') {
                geocodeCache = backupObj.geocodeCache;
                saveGeocodeCache();
                console.log(`已恢复地理编码缓存：${Object.keys(geocodeCache).length} 项 (v${ver})`);
            } else if (!backupObj.geocodeCache) {
                console.log(`备份版本 ${ver} 未包含地理编码缓存字段，恢复后首次需要路径可能重新请求。`);
            }

            // 恢复自定义地址缓存 (1.2+)
            if (ver >= '1.2' && backupObj.customAddresses && typeof backupObj.customAddresses === 'object') {
                window.customAddresses = backupObj.customAddresses;
                const entityKey = currentEntity ? `custom_addresses_${currentEntity}` : 'custom_addresses';
                localStorage.setItem(entityKey, JSON.stringify(window.customAddresses));
                console.log(`已恢复自定义地址缓存：${Object.keys(window.customAddresses).length} 项 (v${ver})`);
                if (typeof renderAddressManagerList === 'function' && document.getElementById('addressManagerModalOverlay').style.display !== 'none') {
                    renderAddressManagerList();
                }
            }

            // 恢复设置
            if (backupObj.settings) {
                const settings = backupObj.settings;

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

            alert(`成功恢复 ${backupObj.records.length} 条记录！`);

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

// ===================== 事件绑定 =====================
// 备份/恢复事件绑定保留在 app.js 中（使用 confirmRun 等全局函数）
// backupData() 和 restoreData() 通过全局作用域暴露

console.log('[Backup Restore Module] ✅ 加载完成');
