// features_help.js - 共享的功能说明内容

function getFeaturesHelpContent() {
    return `
    <li><strong>基础功能</strong>
      <ul>
        <li><strong>模式切换</strong>：支持 🚆 火车 / ✈️ 飞机 双模式，数据独立存储，切换不丢失。</li>
        <li><strong>地图切换</strong>：支持高德地图 / Google Maps，自动重绘现有路线。</li>
        <li><strong>暗色模式</strong>：全站适配深色主题，保护视力。</li>
        <li><strong>行内编辑</strong>：点击表格内容直接修改，支持插入和删除行。</li>
        <li><strong>列排序</strong>：点击表头排序，支持日期、时间、车次/航班号、站点、城市、费用、里程等多列。</li>
        <li><strong>自动计算字段</strong>：速度 (km/h) 和单价 (RMB/km) 自动计算且只读。</li>
        <li><strong>🔄 重新画线</strong>：点击操作菜单中的"重新画线"按钮，强制重新生成路径，可能产生不同曲线外观。</li>
      </ul>
    </li>
    <li><strong>地图与动画</strong>
      <ul>
        <li><strong>路线绘制</strong>：自动计算起终点坐标并绘制弧线；支持路径缓存，避免重复请求。</li>
        <li><strong>动画回放</strong>：支持按时间顺序回放轨迹；支持 🚆 火车(红) / ✈️ 飞机(蓝) / 🌍 全部 混合回放。</li>
        <li><strong>回放模式</strong>：支持"全部年份"、"逐年播放"和"指定年份"；实时显示累计里程。</li>
        <li><strong>交互图例</strong>：右下角图例可筛选特定年份的线路显隐。</li>
      </ul>
    </li>
    <li><strong>🤖 智能功能 (Enhanced)</strong>
      <ul>
        <li><strong>✨ 智能问答</strong>：向 AI 提问您的行程细节（例如"去过哪些城市？"，"最快的一次旅行？"）。自动读取当前全部记录作为上下文。</li>
        <li><strong>⚙️ 灵活配置</strong>：点击首页设置按钮，支持切换 <strong>第三方 AI (ChatAnywhere)</strong> 或 <strong>Gemini 官方
            API</strong>，Key 仅存储在本地。</li>
        <li><strong>年度出行报告</strong>：生成年度足迹报告，包含关键数据和关键词，支持保存为图片。</li>
      </ul>
    </li>
    <li><strong>数据管理</strong>
      <ul>
        <li><strong>导入/导出</strong>：
          <ul>
            <li><strong>CSV/JSON 导出</strong>：包含此前缺失的 <strong>速度 (km/h)</strong> 和 <strong>RMB/km</strong>
              字段；表头自动适配中英文。</li>
            <li><strong>CSV/Excel 导入</strong>：强大容错，自动识别"出发站"/"起点"等多种表头别名。</li>
          </ul>
        </li>
        <li><strong>备份/恢复</strong>：一键创建包含记录、设置和缓存的完整快照 (\`.json\`)，恢复时自动计算衍生数据。</li>
        <li><strong>☁️ 云端同步</strong>：支持 JSONBin 云端同步，多端数据漫游。弹窗已适配深色模式。</li>
      </ul>
    </li>
    <li><strong>统计分析</strong>
      <ul>
        <li><strong>实时面板</strong>：自动计算总里程、总花费、最远路线等。</li>
        <li><strong>多维报表</strong>：包含年度总结、路线热力图、城市访问排名等。</li>
        <li><strong>📊 统计图表</strong>：
          <ul>
            <li><strong>时间维度</strong>：年度/月度的次数、里程、费用、时长图表。</li>
            <li><strong>铁路局/航空公司</strong>：按铁路局(火车)或航空公司(飞机)统计次数，未知值红色高亮。</li>
            <li><strong>车型/机型</strong>：按车型(火车)或机型(飞机)统计次数分布。</li>
          </ul>
        </li>
        <li><strong>交互统计</strong>：点击汇总卡片可高亮表格中对应的记录。</li>
      </ul>
    </li>
    <div style="font-size:12px;opacity:.8;line-height:1.5;">提示：需要新增功能（例如：播放速度、循环回放、批量编辑、过滤条件）可继续提出。</div>
  `;
}

// 初始化功能说明模态框
function initFeaturesHelp() {
    const modalContent = document.querySelector('#featuresHelpModal');
    if (modalContent) {
        // 找到 h3 标签后面插入内容
        const h3 = modalContent.querySelector('h3');
        if (h3) {
            h3.insertAdjacentHTML('afterend', getFeaturesHelpContent());
        }
    }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeaturesHelp);
} else {
    initFeaturesHelp();
}
