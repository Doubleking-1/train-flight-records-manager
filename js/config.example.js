/**
 * API 配置文件 - 示例模板
 * 集中管理所有 API 密钥、URL 和相关配置
 * 
 * 使用说明：
 * 1. 复制此文件并重命名为 config.js
 * 2. 将所有 'YOUR_XXX_KEY' 替换为你的实际 API 密钥
 * 3. 不要将包含真实密钥的 config.js 提交到 Git
 */

// ============ 高德地图安全配置 (必须在脚本加载前定义) ============
window._AMapSecurityConfig = {
  securityJsCode: 'YOUR_AMAP_SECURITY_CODE',
};

const API_CONFIG = {
  // ============ 高德地图配置 ============
  amap: {
    // API密钥
    key: 'YOUR_AMAP_KEY',

    // API版本
    version: '1.4.15',

    // API基础URL
    baseUrl: 'https://webapi.amap.com/maps',

    // 地图样式
    styles: {
      light: 'amap://styles/normal',
      dark: 'amap://styles/dark'
    }
  },

  // ============ Google Maps 配置 ============
  google: {
    // API密钥
    key: 'YOUR_GOOGLE_MAPS_KEY',

    // 需要加载的库
    libraries: ['geometry'],

    // API基础URL
    baseUrl: 'https://maps.googleapis.com/maps/api/js',

    // 地图 ID (用于亮色模式的自定义样式)
    mapId: {
      light: 'f21bd49b93e04288f5eaf463',
      dark: null
    },

    // 暗色模式样式配置
    darkStyles: [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
      { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
      { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
      { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
      { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
      { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
      { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
      { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
      { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
      { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d3a5f" }] },
      { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#7fb3d3" }] },
      { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#0d3a5f" }] }
    ]
  },

  // ============ AI 服务配置 ============
  ai: {
    // 默认提供商: 'gemini' (Gemini官方) 或 'custom' (第三方OpenAI兼容)
    defaultProvider: 'custom',

    // Gemini 官方配置
    gemini: {
      key: 'YOUR_GEMINI_KEY',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      model: 'gemini-2.0-flash-exp'
    },

    // 第三方 AI 配置 (OpenAI 兼容接口)
    custom: {
      key: 'YOUR_CUSTOM_AI_KEY',
      endpoint: 'https://api.chatanywhere.tech/v1/chat/completions',
      model: 'gpt-4o-mini'
    }
  },

  // ============ 其他配置 ============
  other: {
    restKey: 'YOUR_REST_KEY'
  },

  // ============ 外部库 CDN ============
  libraries: {
    sheetjs: 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js',
    chartjs: 'https://cdn.jsdelivr.net/npm/chart.js',
    marked: 'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    html2canvas: 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
  }
};

// ============ 辅助函数 ============

API_CONFIG.getAmapUrl = function () {
  return `${this.amap.baseUrl}?v=${this.amap.version}&key=${this.amap.key}&plugin=AMap.PolyEditor,AMap.Scale`;
};

API_CONFIG.getGoogleMapsUrl = function (callback = 'initGoogleAPI') {
  const libs = this.google.libraries.join(',');
  return `${this.google.baseUrl}?key=${this.google.key}&libraries=${libs}&callback=${callback}`;
};

API_CONFIG.getAmapStyle = function (isDark) {
  return isDark ? this.amap.styles.dark : this.amap.styles.light;
};

API_CONFIG.getGoogleMapOptions = function (isDark) {
  const options = {
    zoom: 5,
    center: { lat: 34.205, lng: 106.712 },
    mapTypeId: 'roadmap'
  };
  if (isDark) {
    options.styles = this.google.darkStyles;
  } else {
    options.mapId = this.google.mapId.light;
  }
  return options;
};

API_CONFIG.getAIConfig = function () {
  const saved = localStorage.getItem('ai_config');
  if (saved) {
    try {
      const config = JSON.parse(saved);
      if (config.provider === 'gemini') {
        return {
          provider: 'gemini',
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
          model: config.model || 'gemini-pro',
          key: config.key
        };
      }
      return {
        provider: 'custom',
        endpoint: config.endpoint || this.ai.custom.endpoint,
        model: config.model || this.ai.custom.model,
        key: config.key || localStorage.getItem('ai_api_key') || this.ai.custom.key
      };
    } catch (e) {
      console.error('Failed to parse ai_config', e);
    }
  }
  return {
    provider: 'custom',
    endpoint: this.ai.custom.endpoint,
    model: this.ai.custom.model,
    key: localStorage.getItem('ai_api_key') || this.ai.custom.key
  };
};

if (typeof window !== 'undefined') {
  window.API_CONFIG = API_CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}

