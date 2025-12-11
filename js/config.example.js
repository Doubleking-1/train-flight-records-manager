/**
 * API 配置文件 - 示例模板
 * 集中管理所有 API 密钥、URL 和相关配置
 * 
 * 使用说明：
 * 1. 复制此文件并重命名为 config.js
 * 2. 将所有 'YOUR_XXX_KEY_HERE' 替换为你的实际 API 密钥
 * 3. 不要将包含真实密钥的 config.js 提交到 Git
 */

// ============ 高德地图安全配置 (必须在脚本加载前定义) ============
window._AMapSecurityConfig = {
    securityJsCode: 'YOUR_AMAP_SECURITY_CODE_HERE',
};

const API_CONFIG = {
    // ============ 高德地图配置 ============
    amap: {
        // API密钥 - 从 https://lbs.amap.com/ 获取
        key: 'YOUR_AMAP_KEY_HERE',

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
        // API密钥 - 从 https://console.cloud.google.com/ 获取
        key: 'YOUR_GOOGLE_MAPS_KEY_HERE',

        // 需要加载的库
        libraries: ['geometry'],

        // API基础URL
        baseUrl: 'https://maps.googleapis.com/maps/api/js',

        // 地图 ID (用于亮色模式的自定义样式)
        mapId: {
            light: 'f21bd49b93e04288f5eaf463',
            dark: '4e8a1c94c8f3a62b'
        },

        // 深色样式配置
        darkStyles: [
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
            {
                featureType: "administrative.locality",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "poi.park",
                elementType: "geometry",
                stylers: [{ color: "#263c3f" }],
            },
            {
                featureType: "poi.park",
                elementType: "labels.text.fill",
                stylers: [{ color: "#6b9a76" }],
            },
            {
                featureType: "road",
                elementType: "geometry",
                stylers: [{ color: "#38414e" }],
            },
            {
                featureType: "road",
                elementType: "geometry.stroke",
                stylers: [{ color: "#212a37" }],
            },
            {
                featureType: "road",
                elementType: "labels.text.fill",
                stylers: [{ color: "#9ca5b3" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry",
                stylers: [{ color: "#746855" }],
            },
            {
                featureType: "road.highway",
                elementType: "geometry.stroke",
                stylers: [{ color: "#1f2835" }],
            },
            {
                featureType: "road.highway",
                elementType: "labels.text.fill",
                stylers: [{ color: "#f3d19c" }],
            },
            {
                featureType: "transit",
                elementType: "geometry",
                stylers: [{ color: "#2f3948" }],
            },
            {
                featureType: "transit.station",
                elementType: "labels.text.fill",
                stylers: [{ color: "#d59563" }],
            },
            {
                featureType: "water",
                elementType: "geometry",
                stylers: [{ color: "#17263c" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.fill",
                stylers: [{ color: "#515c6d" }],
            },
            {
                featureType: "water",
                elementType: "labels.text.stroke",
                stylers: [{ color: "#17263c" }],
            },
        ]
    },

    // ============ AI 服务配置 ============
    ai: {
        // 默认提供商: 'gemini' (Gemini官方) 或 'custom' (第三方OpenAI兼容)
        defaultProvider: 'custom',

        // Gemini 官方配置
        gemini: {
            // API密钥 - 从 https://makersuite.google.com/app/apikey 获取
            key: 'YOUR_GEMINI_KEY_HERE',
            endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
            model: 'gemini-pro'
        },

        // 第三方 AI 配置 (OpenAI 兼容接口)
        custom: {
            // API密钥 - 根据你的服务提供商获取
            key: 'YOUR_CUSTOM_AI_KEY_HERE',
            endpoint: 'https://api.chatanywhere.tech/v1/chat/completions',
            model: 'gpt-3.5-turbo'
        }
    },

    // ============ 第三方库 CDN 配置 ============
    libraries: {
        // Chart.js - 用于统计图表
        chartjs: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',

        // XLSX - 用于 Excel 导入导出
        xlsx: 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',

        // Marked - 用于 Markdown 渲染
        marked: 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js'
    },

    // ============ 工具方法 ============

    /**
     * 获取高德地图完整 URL
     * @returns {string} 完整的高德地图 API URL
     */
    getAmapUrl() {
        return `${this.amap.baseUrl}?v=${this.amap.version}&key=${this.amap.key}`;
    },

    /**
     * 获取 Google Maps 完整 URL
     * @param {string} callbackName - 回调函数名
     * @returns {string} 完整的 Google Maps API URL
     */
    getGoogleMapsUrl(callbackName = 'initGoogleMapsAPI') {
        const params = new URLSearchParams({
            key: this.google.key,
            libraries: this.google.libraries.join(','),
            callback: callbackName,
            v: 'weekly'
        });
        return `${this.google.baseUrl}?${params.toString()}`;
    },

    /**
     * 获取 Google Maps 配置选项
     * @param {boolean} isDark - 是否使用深色模式
     * @returns {Object} Google Maps 配置对象
     */
    getGoogleMapOptions(isDark = false) {
        return {
            styles: isDark ? this.google.darkStyles : null,
            mapId: isDark ? this.google.mapId.dark : this.google.mapId.light
        };
    },

    /**
     * 获取当前 AI 配置
     * @returns {Object} AI 配置对象
     */
    getAIConfig() {
        const provider = localStorage.getItem('aiProvider') || this.ai.defaultProvider;
        const config = this.ai[provider];

        // 从 localStorage 读取用户配置的 key（如果有）
        const savedKey = localStorage.getItem(`ai_${provider}_key`);
        const savedEndpoint = localStorage.getItem(`ai_${provider}_endpoint`);
        const savedModel = localStorage.getItem(`ai_${provider}_model`);

        return {
            provider: provider,
            key: savedKey || config.key,
            endpoint: savedEndpoint || config.endpoint,
            model: savedModel || config.model
        };
    }
};
