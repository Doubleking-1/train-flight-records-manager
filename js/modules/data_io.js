// ===================================
// 数据导入导出模块 (Data IO Module)
// ===================================
//
// 负责 CSV/Excel 导入和 CSV/JSON 导出
// 依赖全局: records, saveRecords(), getEntityConfig(),
//           addRecordToTable(), updateSequenceNumbers(),
//           syncRecordsFromTable(), updateYearLegend(),
//           updateStats(), redrawAllPaths(),
//           parseDurationToMinutes(), confirmRun()

console.log('[Data IO Module] 加载中...');

// ===================== CSV 导入 =====================

function importCsv(file) {
    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const csvText = e.target.result;
            const lines = csvText.split('\n');

            if (lines.length <= 1) {
                throw new Error('CSV文件无数据或格式错误');
            }

            const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            console.log('CSV表头:', headers);

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

            const newRecords = parseCsvToRecords(csvData);

            if (newRecords.length === 0) {
                throw new Error('无法解析CSV数据，请检查文件格式');
            }

            const replace = confirm(
                `成功解析 ${newRecords.length} 条记录\n\n` +
                `点击"确定"替换所有现有数据\n` +
                `点击"取消"添加到现有数据`
            );

            if (replace) {
                records.length = 0;
                newRecords.forEach(r => records.push(r));
            } else {
                newRecords.forEach(r => records.push(r));
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
            let date = '';
            if (row[fieldMap.date]) {
                const dateStr = String(row[fieldMap.date]);
                const match = dateStr.match(/(\d{4})[.\-\/]?(\d{1,2})[.\-\/]?(\d{1,2})/);
                if (match) {
                    const [, y, m, d] = match;
                    date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
            }

            let time = '';
            if (row[fieldMap.time]) {
                const timeStr = String(row[fieldMap.time]).trim();
                const match = timeStr.match(/(\d{1,2})[:\uff1a.]\s*(\d{1,2})/);
                if (match) {
                    const [, h, m] = match;
                    time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
                }
            }

            let duration = '';
            if (row[fieldMap.duration]) {
                const durationStr = String(row[fieldMap.duration]);
                const match = durationStr.match(/(\d{1,2})[:\uff1a](\d{1,2})/);
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

// ===================== CSV 导出 =====================

function exportToCsv() {
    try {
        if (records.length === 0) {
            alert('没有数据可以导出！');
            return;
        }

        const cfg = getEntityConfig();
        const headers = [
            '序号', '时间', '时刻', '时长', cfg.labels.trainNo, cfg.labels.startStation, cfg.labels.startCity,
            cfg.labels.endStation, cfg.labels.endCity, cfg.labels.seatClass, cfg.labels.trainType, cfg.labels.bureau,
            '费用(RMB)', '里程(km)', 'RMB/km', 'km/h', '备注'
        ];

        const csvContent = [];
        csvContent.push(headers.join(','));

        records.forEach((record, index) => {
            const pricePerKm = record.distance > 0 ? (record.cost / record.distance).toFixed(4) : '';

            let speed = '';
            const durationMins = parseDurationToMinutes(record.duration);
            if (record.distance > 0 && durationMins > 0) {
                speed = (record.distance / (durationMins / 60)).toFixed(1);
            }

            const row = [
                index + 1,
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

            const escapedRow = row.map(field => {
                const fieldStr = String(field);
                if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
                    return '"' + fieldStr.replace(/"/g, '""') + '"';
                }
                return fieldStr;
            });

            csvContent.push(escapedRow.join(','));
        });

        const csvString = csvContent.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        link.setAttribute('download', `${cfg.exportPrefix}_${dateStr}.csv`);

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

// ===================== Excel 导入 =====================

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
                if (row.length === 0 || !row.some(cell => cell)) return;

                const recordData = {};

                for (const [field, columnIndex] of Object.entries(columnMap)) {
                    if (columnIndex !== undefined && row[columnIndex] !== undefined) {
                        recordData[field] = String(row[columnIndex]).trim();
                    }
                }

                if (recordData.date) {
                    const dateStr = String(recordData.date);
                    if (dateStr.includes('/')) {
                        const parts = dateStr.split('/');
                        if (parts.length === 3) {
                            recordData.date = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        }
                    }
                }

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

// ===================== JSON 导出 =====================

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

// ===================== 事件绑定 =====================
// 注意: 事件绑定保留在 app.js 中（因为它们使用 confirmRun 等全局函数）
// 以下函数通过全局作用域暴露给 app.js 中的事件监听器调用

console.log('[Data IO Module] ✅ 加载完成');
