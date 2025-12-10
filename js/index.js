const USER_KEY = 'username';
const TRAIN_KEY = 'trainRecords';
const PLANE_KEY = 'planeRecords';
const GEOCODE_CACHE_KEY = 'geocodeCache';
let trainMap, planeMap, combinedMap;

function initGoogleAPI() { /* 占位回调，实际使用高德主渲染 */ }

function $(id) { return document.getElementById(id); }

function loadRecords() {
  let trains = []; let planes = [];
  try { trains = JSON.parse(localStorage.getItem(TRAIN_KEY)) || []; } catch (e) { }
  try { planes = JSON.parse(localStorage.getItem(PLANE_KEY)) || []; } catch (e) { }
  return { trains, planes };
}

function computeStats(records) {
  const total = records.length;
  const totalDistance = records.reduce((s, r) => s + (r.distance || 0), 0);
  const totalMinutes = records.reduce((s, r) => s + parseDuration(r.duration), 0);
  return { total, totalDistance, totalMinutes };
}

function formatNumber(num) {
  return num.toLocaleString('zh-CN');
}

function formatDistance(km) {
  if (km >= 10000) {
    return (km / 10000).toFixed(1) + ' <span class="unit-small">万公里</span>';
  }
  return formatNumber(km) + ' <span class="unit-small">公里</span>';
}

function parseDuration(durationStr) {
  if (!durationStr) return 0;
  const match = durationStr.match(/(\d{1,2}):(\d{1,2})/);
  if (match) {
    return (parseInt(match[1]) || 0) * 60 + (parseInt(match[2]) || 0);
  }
  return 0;
}

function formatDuration(minutes) {
  const h = (minutes / 60).toFixed(1);
  return h + ' <span class="unit-small">小时</span>';
}

function updateSummary() {
  const { trains, planes } = loadRecords();
  const t = computeStats(trains); const p = computeStats(planes);
  const allCount = t.total + p.total;
  const allDist = t.totalDistance + p.totalDistance;
  const allMinutes = t.totalMinutes + p.totalMinutes;
  const statEl = $('summaryStats');
  statEl.innerHTML = `
        <div class='stat-section'>
          <div class='stat-header'>🚄 火车数据</div>
          <div class='stat-row'>
            <div class='stat-item'>
              <div class='stat-label'>行程数</div>
              <div class='stat-value'>${formatNumber(t.total)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总里程</div>
              <div class='stat-value'>${formatDistance(t.totalDistance)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总时长</div>
              <div class='stat-value'>${formatDuration(t.totalMinutes)}</div>
            </div>
          </div>
        </div>
        <div class='stat-section'>
          <div class='stat-header'>✈️ 飞机数据</div>
          <div class='stat-row'>
            <div class='stat-item'>
              <div class='stat-label'>行程数</div>
              <div class='stat-value'>${formatNumber(p.total)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总里程</div>
              <div class='stat-value'>${formatDistance(p.totalDistance)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总时长</div>
              <div class='stat-value'>${formatDuration(p.totalMinutes)}</div>
            </div>
          </div>
        </div>
        <div class='stat-section stat-section-total'>
          <div class='stat-header'>📊 总计</div>
          <div class='stat-row'>
            <div class='stat-item'>
              <div class='stat-label'>总行程</div>
              <div class='stat-value stat-value-highlight'>${formatNumber(allCount)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总里程</div>
              <div class='stat-value stat-value-highlight'>${formatDistance(allDist)}</div>
            </div>
            <div class='stat-item'>
              <div class='stat-label'>总时长</div>
              <div class='stat-value stat-value-highlight'>${formatDuration(allMinutes)}</div>
            </div>
          </div>
        </div>`;
  $('lastUpdateInfo').textContent = '最后更新：' + new Date().toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function applyMapTheme() {
  const isDark = document.body.classList.contains('dark');
  const styleId = isDark ? 'amap://styles/dark' : 'amap://styles/normal';
  try { if (trainMap) trainMap.setMapStyle(styleId); } catch (e) { }
  try { if (planeMap) planeMap.setMapStyle(styleId); } catch (e) { }
  try { if (combinedMap) combinedMap.setMapStyle(styleId); } catch (e) { }
}

function applyThemeUI() {
  const btn = $('toggleThemeBtn');
  if (btn) btn.textContent = document.body.classList.contains('dark') ? '浅色模式' : '暗色模式';
  applyMapTheme();
}

function initMaps() {
  // 检查高德地图 API 是否已加载
  if (typeof AMap === 'undefined') {
    console.warn('⏳ 高德地图 API 尚未加载，等待中...');
    // 使用轮询等待 API 加载
    const checkInterval = setInterval(() => {
      if (typeof AMap !== 'undefined') {
        clearInterval(checkInterval);
        console.log('✅ 高德地图 API 已就绪，开始初始化地图');
        initMaps(); // 递归调用自己
      }
    }, 100);
    return;
  }

  try {
    trainMap = new AMap.Map('trainMap', { viewMode: '2D', zoom: 4, center: [105, 35], scrollWheel: false });
    planeMap = new AMap.Map('planeMap', { viewMode: '2D', zoom: 4, center: [105, 35], scrollWheel: false });
    combinedMap = new AMap.Map('combinedMap', { viewMode: '2D', zoom: 4, center: [105, 35], scrollWheel: false });
    applyMapTheme();
    console.log('✅ 地图初始化成功（包括合并视图）');
  } catch (e) {
    console.error('❌ 地图初始化失败:', e);
  }
  drawExisting();
}

function drawExisting() {
  const { trains, planes } = loadRecords();

  // 为单独的地图绘制
  const drawSet = [
    { map: trainMap, arr: trains, color: '#ff6b6b' },
    { map: planeMap, arr: planes, color: '#4dabf7' }
  ];

  drawSet.forEach(cfg => {
    if (!cfg.map) return;
    cfg.arr.forEach(r => {
      if (Array.isArray(r.pathWGS) && r.pathWGS.length) {
        try {
          const path = r.pathWGS.map(p => [p[0], p[1]]); // WGS: [lon, lat]
          const poly = new AMap.Polyline({ path, strokeColor: cfg.color, strokeOpacity: 0.85, strokeWeight: 2 });
          cfg.map.add(poly);
        } catch (e) { }
      }
    });
  });

  // 为合并地图绘制（火车用红色，飞机用蓝色）
  if (combinedMap) {
    // 绘制火车线路（红色）
    trains.forEach(r => {
      if (Array.isArray(r.pathWGS) && r.pathWGS.length) {
        try {
          const path = r.pathWGS.map(p => [p[0], p[1]]);
          const poly = new AMap.Polyline({
            path,
            strokeColor: '#ff6b6b',  // 红色 - 火车
            strokeOpacity: 0.7,
            strokeWeight: 2
          });
          combinedMap.add(poly);
        } catch (e) { }
      }
    });

    // 绘制飞机线路（蓝色）
    planes.forEach(r => {
      if (Array.isArray(r.pathWGS) && r.pathWGS.length) {
        try {
          const path = r.pathWGS.map(p => [p[0], p[1]]);
          const poly = new AMap.Polyline({
            path,
            strokeColor: '#4dabf7',  // 蓝色 - 飞机
            strokeOpacity: 0.7,
            strokeWeight: 2
          });
          combinedMap.add(poly);
        } catch (e) { }
      }
    });
  }

  $('statusPill').textContent = '已加载';
}

// 用户名功能已移除
function saveUsername() { }
function loadUsername() { }

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
  applyThemeUI();
}

// storage 同步（如果另一个页面更新数据，这里可主动刷新）
window.addEventListener('storage', (e) => {
  if ([TRAIN_KEY, PLANE_KEY].includes(e.key)) {
    updateSummary();
    // 简单做：重新创建地图以避免清理麻烦
    initMaps();
  }
});

window.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') document.body.classList.add('dark');
  applyThemeUI();
  loadUsername();
  updateSummary();
  initMaps();
  // 用户名功能移除，无需监听保存
  $('refreshBtn').addEventListener('click', () => { updateSummary(); initMaps(); });
  $('clearCacheBtn').addEventListener('click', () => {
    if (confirm('确定仅清除地理编码缓存(不会删除行程记录)？')) { localStorage.removeItem(GEOCODE_CACHE_KEY); $('statusPill').textContent = '已清空地理编码缓存'; }
  });
  $('toggleThemeBtn').addEventListener('click', toggleTheme);
  // 备份全部
  $('backupAllBtn').addEventListener('click', () => {
    if (!confirm('备份包含：火车+飞机全部记录(含已缓存路径) + 地理编码缓存 + 当前主题。继续？')) return;
    let trains = JSON.parse(localStorage.getItem(TRAIN_KEY) || '[]');
    let planes = JSON.parse(localStorage.getItem(PLANE_KEY) || '[]');
    let geo = JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || '{}');
    const payload = {
      backupDate: new Date().toISOString(),
      version: '2.0',
      trains, planes,
      geocodeCache: geo,
      settings: {
        theme: document.body.classList.contains('dark') ? 'dark' : 'light'
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '全部出行备份_' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  });
  // 恢复全部
  $('restoreAllBtn').addEventListener('click', () => {
    if (!confirm('恢复将覆盖当前火车/飞机所有记录与缓存，继续？')) return;
    $('restoreAllFile').click();
  });
  $('restoreAllFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return; e.target.value = '';
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data || (!Array.isArray(data.trains) && !Array.isArray(data.planes))) { alert('文件格式不正确'); return; }
        localStorage.setItem(TRAIN_KEY, JSON.stringify(data.trains || []));
        localStorage.setItem(PLANE_KEY, JSON.stringify(data.planes || []));
        if (data.geocodeCache && typeof data.geocodeCache === 'object') {
          localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(data.geocodeCache));
        }
        if (data.settings && data.settings.theme) {
          if (data.settings.theme === 'dark') document.body.classList.add('dark'); else document.body.classList.remove('dark');
          localStorage.setItem('theme', data.settings.theme);
        }
        applyThemeUI();
        updateSummary(); initMaps();
        $('statusPill').textContent = '恢复完成';
        alert('恢复完成：火车 ' + (data.trains ? data.trains.length : 0) + ' 条，飞机 ' + (data.planes ? data.planes.length : 0) + ' 条');
      } catch (err) {
        alert('恢复失败: ' + err.message);
      }
    };
    reader.readAsText(f, 'UTF-8');
  });

  // ============ Map Interaction Enhancements ============
  // 按住 Command (Mac) 或 Alt (Windows) 键开启地图缩放
  const isZoomKey = (e) => e.key === 'Meta' || e.key === 'Alt';

  window.addEventListener('keydown', (e) => {
    if (isZoomKey(e)) {
      [trainMap, planeMap, combinedMap].forEach(m => {
        if (m) m.setStatus({ scrollWheel: true });
      });
    }
  });

  window.addEventListener('keyup', (e) => {
    if (isZoomKey(e)) {
      [trainMap, planeMap, combinedMap].forEach(m => {
        if (m) m.setStatus({ scrollWheel: false });
      });
    }
  });

  // --- Feature Help Modal ---
  const featuresHelpBtn = document.getElementById('featuresHelpBtn');
  const featuresHelpOverlay = document.getElementById('featuresHelpOverlay');
  const featuresHelpClose = document.getElementById('featuresHelpClose');

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
    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && featuresHelpOverlay.style.display === 'flex') {
        featuresHelpOverlay.style.display = 'none';
      }
    });
  }
  // Initialize Cloud Sync
  const cloudSync = new CloudSync();
});

// ===================== Gemini Q&A Feature =====================
const askGeminiBtn = document.getElementById('askGeminiBtn');
const geminiQAModalOverlay = document.getElementById('geminiQAModalOverlay');
const geminiQACloseBtn = document.getElementById('geminiQACloseBtn');
const geminiQAInput = document.getElementById('geminiQAInput');
const geminiQASendBtn = document.getElementById('geminiQASendBtn');
const geminiQAChatHistory = document.getElementById('geminiQAChatHistory');

if (askGeminiBtn) {
  askGeminiBtn.addEventListener('click', () => {
    geminiQAModalOverlay.style.display = 'flex';
    // Add delay to ensure modal is rendered before focusing
    setTimeout(() => {
      geminiQAInput.focus();
    }, 100);
  });
}

if (geminiQACloseBtn) {
  geminiQACloseBtn.addEventListener('click', () => {
    geminiQAModalOverlay.style.display = 'none';
  });
}

if (geminiQAModalOverlay) {
  geminiQAModalOverlay.addEventListener('click', (e) => {
    if (e.target === geminiQAModalOverlay) {
      geminiQAModalOverlay.style.display = 'none';
    }
  });
}

if (geminiQASendBtn) {
  geminiQASendBtn.addEventListener('click', submitGeminiQuestion);
}

if (geminiQAInput) {
  // Prevent global key handlers from interfering
  geminiQAInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
  });

  geminiQAInput.addEventListener('keypress', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submitGeminiQuestion();
  });
}

// ===================== AI Config Feature =====================
const aiSettingsBtn = document.getElementById('aiSettingsBtn');
const aiConfigModalOverlay = document.getElementById('aiConfigModalOverlay');
const aiConfigCloseBtn = document.getElementById('aiConfigCloseBtn');
const aiConfigCancelBtn = document.getElementById('aiConfigCancelBtn');
const aiConfigSaveBtn = document.getElementById('aiConfigSaveBtn');
const aiConfigFields = document.getElementById('aiConfigFields');

if (aiSettingsBtn) {
  aiSettingsBtn.addEventListener('click', openAIConfig);
}
// Close handlers
[aiConfigCloseBtn, aiConfigCancelBtn].forEach(btn => {
  if (btn) btn.addEventListener('click', () => aiConfigModalOverlay.style.display = 'none');
});
if (aiConfigModalOverlay) {
  aiConfigModalOverlay.addEventListener('click', e => {
    if (e.target === aiConfigModalOverlay) aiConfigModalOverlay.style.display = 'none';
  });
}
if (aiConfigSaveBtn) {
  aiConfigSaveBtn.addEventListener('click', saveAIConfig);
}

// Handle Provider Switch
const providerRadios = document.getElementsByName('aiProvider');
providerRadios.forEach(radio => {
  radio.addEventListener('change', renderAIConfigFields);
});

function openAIConfig() {
  const config = API_CONFIG.getAIConfig();

  // Set provider radio
  const radio = document.querySelector(`input[name="aiProvider"][value="${config.provider}"]`);
  if (radio) radio.checked = true;

  renderAIConfigFields(); // Render fields first

  // Fill values
  setTimeout(() => {
    const keyInput = document.getElementById('cfg_key');
    if (keyInput) keyInput.value = config.key || '';

    // For both custom and gemini, fill model if present
    const modelInput = document.getElementById('cfg_model');
    if (modelInput && config.model) modelInput.value = config.model;

    if (config.provider === 'custom') {
      const urlInput = document.getElementById('cfg_endpoint');
      if (urlInput) urlInput.value = config.endpoint;
    }
  }, 0);

  aiConfigModalOverlay.style.display = 'flex';
}

function renderAIConfigFields() {
  const provider = document.querySelector('input[name="aiProvider"]:checked').value;
  let html = '';

  if (provider === 'custom') {
    html = `
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text);">API Endpoint (Base URL)</label>
        <input type="text" id="cfg_endpoint" placeholder="https://api.openai.com/v1/chat/completions" 
          style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px; background:var(--bg); color:var(--text); box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text);">Model Name</label>
        <input type="text" id="cfg_model" placeholder="gpt-3.5-turbo" 
          style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px; background:var(--bg); color:var(--text); box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text);">API Key</label>
        <div style="position:relative; display:flex;">
          <input type="password" id="cfg_key" placeholder="sk-..." 
            style="flex:1; padding:8px; padding-right:35px; border:1px solid var(--border); border-radius:4px; background:var(--bg); color:var(--text); box-sizing:border-box;">
          <button type="button" onclick="toggleKeyVisibility('cfg_key')" 
            style="position:absolute; right:2px; top:2px; bottom:2px; background:none; border:none; cursor:pointer; padding:0 8px; opacity:0.6;" title="显示/隐藏">👁️</button>
        </div>
      </div>
    `;
  } else {
    // Gemini Official
    html = `
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text);">Model Name (Optional)</label>
        <input type="text" id="cfg_model" placeholder="gemini-pro" 
          style="width:100%; padding:8px; border:1px solid var(--border); border-radius:4px; background:var(--bg); color:var(--text); box-sizing:border-box;">
         <p style="margin:4px 0 0; font-size:11px; opacity:0.6;">默认为 gemini-pro，可输入 gemini-1.5-flash 等。</p>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; color:var(--text);">Gemini API Key</label>
        <div style="position:relative; display:flex;">
          <input type="password" id="cfg_key" placeholder="AIza..." 
            style="flex:1; padding:8px; padding-right:35px; border:1px solid var(--border); border-radius:4px; background:var(--bg); color:var(--text); box-sizing:border-box;">
          <button type="button" onclick="toggleKeyVisibility('cfg_key')" 
            style="position:absolute; right:2px; top:2px; bottom:2px; background:none; border:none; cursor:pointer; padding:0 8px; opacity:0.6;" title="显示/隐藏">👁️</button>
        </div>
        <p style="margin-top:4px; font-size:11px; opacity:0.7;">将使用官方 endpoint 模式。</p>
      </div>
    `;
  }

  aiConfigFields.innerHTML = html;
}

window.toggleKeyVisibility = function (id) {
  const input = document.getElementById(id);
  if (input) {
    input.type = input.type === 'password' ? 'text' : 'password';
  }
};

function saveAIConfig() {
  const provider = document.querySelector('input[name="aiProvider"]:checked').value;
  const key = document.getElementById('cfg_key').value.trim();

  if (!key) {
    alert('请输入 API Key');
    return;
  }

  const config = { provider, key };

  // Custom OR Gemini both can have model now
  const model = document.getElementById('cfg_model').value.trim();
  if (model) config.model = model;

  if (provider === 'custom') {
    const endpoint = document.getElementById('cfg_endpoint').value.trim();
    if (!endpoint) {
      alert('请输入 API Endpoint');
      return;
    }
    config.endpoint = endpoint;
    if (!config.model) config.model = 'gpt-3.5-turbo';
  }

  localStorage.setItem('ai_config', JSON.stringify(config));
  // Backward compatibility
  localStorage.setItem('ai_api_key', key);

  alert('配置已保存！');
  aiConfigModalOverlay.style.display = 'none';
}

// --- AI API Key Management ---
// --- AI API Key Management ---
function getAIKey() {
  const config = API_CONFIG.getAIConfig();
  return config.key;
}

window.saveAIKey = function () {
  const input = document.getElementById('aiKeyInput');
  if (input && input.value.trim()) {
    localStorage.setItem('ai_api_key', input.value.trim());
    alert('API Key 已保存！请重新发送消息。');
    const form = input.closest('.api-config-form').parentElement;
    if (form) form.remove();
  } else {
    alert('请输入有效的 API Key');
  }
};

async function submitGeminiQuestion() {
  const question = geminiQAInput.value.trim();
  if (!question) return;

  appendMessage('user', question);
  geminiQAInput.value = '';

  // Check API Key
  const apiKey = getAIKey();
  if (!apiKey) {
    appendMessage('gemini', `
      <div class="api-config-form">
        <p>⚠️ 检测到未配置 AI API Key，请配置：</p>
        <input type="password" id="aiKeyInput" placeholder="在此输入 API Key (ChatAnywhere/OpenAI)" />
        <button onclick="saveAIKey()">💾 保存配置</button>
        <p style="margin-top:8px;font-size:12px;opacity:0.8;">Key 将仅存储在您的浏览器本地缓存中。</p>
      </div>
    `);
    return;
  }

  const loadingId = appendMessage('gemini', '<div class="typing-indicator"><span></span><span></span><span></span></div>');

  try {
    const { trains, planes } = loadRecords();

    // Combine and include all relevant fields
    const allRecords = [
      ...trains.map(r => ({
        type: 'Train',
        date: r.date,
        time: r.time,
        duration: r.duration,
        trainNo: r.trainNo,
        startStation: r.startStation,
        startCity: r.startCity,
        endStation: r.endStation,
        endCity: r.endCity,
        seatClass: r.seatClass,
        trainType: r.trainType,
        bureau: r.bureau,
        cost: r.cost,
        distance: r.distance,
        notes: r.notes
      })),
      ...planes.map(r => ({
        type: 'Plane',
        date: r.date,
        time: r.time,
        duration: r.duration,
        flightNo: r.trainNo, // Map trainNo to flightNo for planes
        startAirport: r.startStation, // Map startStation to startAirport
        startCity: r.startCity,
        endAirport: r.endStation, // Map endStation to endAirport
        endCity: r.endCity,
        seatClass: r.seatClass,
        planeType: r.trainType, // Map trainType to planeType
        airline: r.bureau, // Map bureau to airline
        cost: r.cost,
        distance: r.distance,
        notes: r.notes
      }))
    ];

    const dataContext = JSON.stringify(allRecords);
    const prompt = `你是一个旅行数据分析助手。以下是用户的旅行记录数据（JSON格式，包含火车和飞机记录）：
${dataContext}

用户问题：${question}

请回答问题。如果需要列出具体行程，请使用自然语言或Markdown列表的形式（例如：“2023年1月1日从北京去往上海，乘坐G123次列车”），**绝对不要**直接输出JSON格式的数据。`;

    const response = await callAIAPI(prompt);

    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();

    if (typeof marked !== 'undefined') {
      appendMessage('gemini', marked.parse(response));
    } else {
      appendMessage('gemini', response);
    }

  } catch (error) {
    console.error('AI Q&A Error:', error);
    const loadingEl = document.getElementById(loadingId);
    if (loadingEl) loadingEl.remove();
    appendMessage('gemini', `❌ 请求失败: ${error.message}`);
  }
}

// Close on ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && geminiQAModalOverlay.style.display === 'flex') {
    geminiQAModalOverlay.style.display = 'none';
  }
});

function appendMessage(role, content) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';

  if (role === 'user') {
    bubble.textContent = content;
  } else {
    bubble.innerHTML = content;
  }

  msgDiv.appendChild(bubble);

  const id = 'msg-' + Date.now();
  msgDiv.id = id;

  geminiQAChatHistory.appendChild(msgDiv);
  geminiQAChatHistory.scrollTop = geminiQAChatHistory.scrollHeight;
  return id;
}

async function callAIAPI(prompt) {
  const config = API_CONFIG.getAIConfig(); // Dynamic Config

  if (!config.key) throw new Error('API Key missing');

  const apiUrl = config.endpoint;
  const model = config.model; // For Gemini this might be ignored by the endpoint format if using v1beta, but usually generic

  // Construct payload based on provider
  let payload;
  let headers = {
    'Content-Type': 'application/json'
  };

  if (config.provider === 'gemini') {
    // Google Gemini Official API Format
    // Endpoint base: https://generativelanguage.googleapis.com/v1beta/models
    // Full URL: BASE/{MODEL}:generateContent?key={KEY}

    // Check if endpoint already includes the model (legacy config might)
    let urlWithKey;
    if (apiUrl.includes(':generateContent')) {
      urlWithKey = `${apiUrl}?key=${config.key}`;
    } else {
      // Construct with dynamic model
      const modelName = config.model || 'gemini-pro';
      urlWithKey = `${apiUrl}/${modelName}:generateContent?key=${config.key}`;
    }

    payload = {
      contents: [{
        parts: [{ text: prompt }]
      }]
    };

    const response = await fetch(urlWithKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
      return result.candidates[0].content.parts[0].text;
    } else {
      throw new Error('No valid response from Gemini API');
    }

  } else {
    // Custom / OpenAI Compatible
    headers['Authorization'] = `Bearer ${config.key}`;

    payload = {
      model: model,
      messages: [
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    if (result.choices && result.choices.length > 0 && result.choices[0].message) {
      return result.choices[0].message.content;
    } else {
      throw new Error('No valid response from AI API');
    }
  }
}
