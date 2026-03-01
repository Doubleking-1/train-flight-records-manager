// ===================================
// Gemini Q&A 模块 (AI Smart Q&A Module)
// ===================================
//
// 负责 AI 智能问答功能
// - 弹窗管理
// - 消息渲染
// - AI API 调用 (Gemini / OpenAI Compatible)

console.log('[Gemini QA Module] 加载中...');

// ---- DOM 元素 ----
const _qaOverlay = document.getElementById('geminiQAModalOverlay');
const _qaCloseBtn = document.getElementById('geminiQACloseBtn');
const _qaInput = document.getElementById('geminiQAInput');
const _qaSendBtn = document.getElementById('geminiQASendBtn');
const _qaChatHistory = document.getElementById('geminiQAChatHistory');
const _qaOpenBtn = document.getElementById('askGeminiBtn');

// ---- AI API Key 管理 ----

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

// ---- 消息渲染 ----

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

    _qaChatHistory.appendChild(msgDiv);
    _qaChatHistory.scrollTop = _qaChatHistory.scrollHeight;
    return id;
}

// ---- AI API 调用 ----

async function callAIAPI(prompt) {
    const config = API_CONFIG.getAIConfig();
    if (!config.key) throw new Error('API Key missing');

    const apiUrl = config.endpoint;
    const model = config.model;

    if (config.provider === 'gemini') {
        let urlWithKey;
        if (apiUrl.includes(':generateContent')) {
            urlWithKey = `${apiUrl}?key=${config.key}`;
        } else {
            const modelName = config.model || 'gemini-pro';
            urlWithKey = `${apiUrl}/${modelName}:generateContent?key=${config.key}`;
        }

        const payload = {
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
        const payload = {
            model: model,
            messages: [
                { role: "user", content: prompt }
            ],
            temperature: 0.7
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
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

// ---- 提交问题 ----

async function submitGeminiQuestion() {
    const question = _qaInput.value.trim();
    if (!question) return;

    appendMessage('user', question);
    _qaInput.value = '';

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
        let trains = [];
        let planes = [];
        try { trains = JSON.parse(localStorage.getItem('trainRecords')) || []; } catch (e) { }
        try { planes = JSON.parse(localStorage.getItem('planeRecords')) || []; } catch (e) { }

        const allRecords = [
            ...trains.map(r => ({
                type: 'Train',
                date: r.date, time: r.time, duration: r.duration,
                trainNo: r.trainNo, startStation: r.startStation, startCity: r.startCity,
                endStation: r.endStation, endCity: r.endCity, seatClass: r.seatClass,
                trainType: r.trainType, bureau: r.bureau, cost: r.cost,
                distance: r.distance, notes: r.notes
            })),
            ...planes.map(r => ({
                type: 'Plane',
                date: r.date, time: r.time, duration: r.duration,
                flightNo: r.trainNo, startAirport: r.startStation, startCity: r.startCity,
                endAirport: r.endStation, endCity: r.endCity, seatClass: r.seatClass,
                planeType: r.trainType, airline: r.bureau, cost: r.cost,
                distance: r.distance, notes: r.notes
            }))
        ];

        const dataContext = JSON.stringify(allRecords);
        const prompt = `你是一个旅行数据分析助手。以下是用户的旅行记录数据（JSON格式，包含火车和飞机记录）：
${dataContext}

用户问题：${question}

请回答问题。如果需要列出具体行程，请使用自然语言或Markdown列表的形式（例如："2023年1月1日从北京去往上海，乘坐G123次列车"），**绝对不要**直接输出JSON格式的数据。`;

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

// ---- 事件绑定 ----

if (_qaOpenBtn) {
    _qaOpenBtn.addEventListener('click', () => {
        _qaOverlay.style.display = 'flex';
        setTimeout(() => { _qaInput.focus(); }, 100);
    });
}

if (_qaCloseBtn) {
    _qaCloseBtn.addEventListener('click', () => {
        _qaOverlay.style.display = 'none';
    });
}

if (_qaOverlay) {
    _qaOverlay.addEventListener('click', (e) => {
        if (e.target === _qaOverlay) _qaOverlay.style.display = 'none';
    });
}

if (_qaSendBtn) {
    _qaSendBtn.addEventListener('click', submitGeminiQuestion);
}

if (_qaInput) {
    _qaInput.addEventListener('keydown', (e) => { e.stopPropagation(); });
    _qaInput.addEventListener('keypress', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') submitGeminiQuestion();
    });
}

// ESC 关闭已迁移到 app.js / index.js


console.log('[Gemini QA Module] ✅ 加载完成');
