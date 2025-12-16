// ===================================
// 工具函数模块 (Utils/Helpers)
// ===================================
//
// 包含纯函数工具，无副作用，易于测试和复用
// - 坐标转换
// - 时长格式化
// - 数据验证

console.log('[Utils Module] 加载中...');

// ===========================================
// 1. 坐标转换函数 (Coordinate Conversion)
// ===========================================

const pi = 3.14159265358979324;
const a = 6378245.0;
const ee = 0.00669342162296594323;

function transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * pi) + 40.0 * Math.sin(y / 3.0 * pi)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * pi) + 320 * Math.sin(y * pi / 30.0)) * 2.0 / 3.0;
    return ret;
}

function transformLon(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * pi) + 40.0 * Math.sin(x / 3.0 * pi)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * pi) + 300.0 * Math.sin(x / 30.0 * pi)) * 2.0 / 3.0;
    return ret;
}

function isInChina(lng, lat) {
    return (lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55);
}

function wgs84ToGcj02(lon, lat) {
    if (!isInChina(lon, lat)) return [lon, lat];

    let dLat = transformLat(lon - 105.0, lat - 35.0);
    let dLon = transformLon(lon - 105.0, lat - 35.0);

    const radLat = lat / 180.0 * pi;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
    dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);

    return [lon + dLon, lat + dLat];
}

function gcj02ToWgs84(lon, lat) {
    if (!isInChina(lon, lat)) return [lon, lat];

    let dLat = transformLat(lon - 105.0, lat - 35.0);
    let dLon = transformLon(lon - 105.0, lat - 35.0);

    const radLat = lat / 180.0 * pi;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);

    dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * pi);
    dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * pi);

    const mgLon = lon + dLon;
    const mgLat = lat + dLat;

    return [lon * 2 - mgLon, lat * 2 - mgLat];
}

console.log('[Utils Module] 坐标转换函数已加载');

// ===========================================
// 2. 时长格式化函数 (Duration Formatting)
// ===========================================

function parseDurationToMinutes(duration) {
    if (!duration) return 0;
    const match = duration.match(/(\d{1,2}):(\d{1,2})/);
    if (!match) return 0;
    return (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
}

function formatMinutesToDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
}

console.log('[Utils Module] 时长格式化函数已加载');

console.log('[Utils Module] ✅ 全部加载完成');
