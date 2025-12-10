# 🚀 GitHub 上传准备指南

## ✅ 准备工作清单

### 1. 安全性检查（必须完成！）

- [ ] **移除真实 API Keys**
  ```bash
  # 1. 备份当前的 config.js（包含你的真实 keys）
  cp js/config.js js/config.local.js
  
  # 2. 将 config.example.js 复制为 config.js
  cp js/config.example.js js/config.js
  
  # 3. 编辑 config.js，将所有 YOUR_XXX_KEY_HERE 替换为真实密钥
  # （仅在本地使用，不要提交到 Git）
  ```

- [ ] **检查 .gitignore 是否正确**
  - 确保 `js/config.js` 已被忽略
  - 确保 `js/config.local.js` 已被忽略

### 2. 添加必要文件

已创建的文件：
- ✅ `.gitignore` - 忽略敏感文件
- ✅ `LICENSE` - MIT 开源协议
- ✅ `js/config.example.js` - API 配置模板

### 3. 更新 README.md

在 README.md 中添加配置说明：

```markdown
## ⚙️ 配置步骤

### 首次使用配置

1. **复制配置文件**
   ```bash
   cp js/config.example.js js/config.js
   ```

2. **获取并配置 API Keys**（可选，但推荐）

   #### 高德地图 API
   - 访问 [高德开放平台](https://lbs.amap.com/)
   - 注册账号并创建应用
   - 获取 Web 服务 Key 和安全密钥
   - 在 `js/config.js` 中填入：
     - `amap.key`
     - `_AMapSecurityConfig.securityJsCode`

   #### Google Maps API
   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 启用 Maps JavaScript API
   - 创建 API 密钥
   - 在 `js/config.js` 中填入 `google.key`

   #### AI 功能（可选）
   - **Gemini**: 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
   - **其他 OpenAI 兼容 API**: 根据服务提供商说明获取
   - 在 `js/config.js` 中配置相应的 key 和 endpoint

3. **打开应用**
   直接在浏览器中打开 `index.html` 或 `app.html`

### 注意事项
⚠️ **不要将包含真实 API Keys 的 `config.js` 提交到 Git！**
```

### 4. 创建 GitHub Repository

#### 4.1 初始化 Git 仓库

```bash
cd /Users/dk/Codes/train/dev
git init
git add .
git commit -m "Initial commit: Train & Flight Records Manager v8.0.0"
```

#### 4.2 在 GitHub 上创建仓库

1. 访问 https://github.com/new
2. 填写信息：
   - Repository name: `train-flight-records-manager` （建议）
   - Description: `🚆✈️ 离线网页应用，管理和可视化火车/飞机出行记录，支持地图展示、AI 分析、统计图表`
   - Public（公开）
   - 不要勾选 Initialize with README（我们已有）

3. 创建后，运行：
```bash
git remote add origin https://github.com/你的用户名/train-flight-records-manager.git
git branch -M main
git push -u origin main
```

### 5. 优化 GitHub 展示

#### 5.1 添加截图（建议）

创建 `screenshots/` 目录，添加应用截图：
- 主页概览图
- 管理页面图
- 地图可视化图
- 统计图表图
- AI 问答演示图

然后在 README.md 顶部添加：
```markdown
## 📸 应用截图

### 主页 - 地图概览
![主页截图](screenshots/homepage.png)

### 管理页 - 数据编辑
![管理页截图](screenshots/management.png)

### 统计图表
![统计图表](screenshots/charts.png)
```

#### 5.2 添加 GitHub Topics

在 GitHub 仓库页面设置 Topics（标签）：
- `travel-tracking`
- `data-visualization`
- `offline-first`
- `javascript`
- `amap`
- `google-maps`
- `chartjs`
- `ai-powered`
- `chinese`

#### 5.3 创建 GitHub Pages（在线演示）

1. 在 GitHub 仓库设置中启用 GitHub Pages
2. 选择 main 分支
3. 访问 `https://你的用户名.github.io/train-flight-records-manager/`

**注意**: 演示版本需要用户自己配置 API keys

### 6. 推荐：添加在线演示说明

在 README.md 添加：

```markdown
## 🌐 在线演示

访问 [GitHub Pages 演示](https://你的用户名.github.io/train-flight-records-manager/)

**注意**: 演示版本需要您自行配置 API Keys，请参考配置步骤。
```

### 7. 安全检查清单

上传前最后检查：

- [ ] `js/config.js` 是否在 `.gitignore` 中？
- [ ] `js/config.example.js` 中是否已移除所有真实 keys？
- [ ] 运行 `git status` 确认 `js/config.js` 不在待提交列表中
- [ ] README.md 是否包含配置说明？
- [ ] LICENSE 文件是否存在？

### 8. 提交前测试

```bash
# 检查哪些文件会被提交
git status

# 检查 config.js 是否被正确忽略
git check-ignore js/config.js
# 应该输出: js/config.js

# 确认没有敏感信息
git diff --staged
```

## 📝 建议的 README.md 补充内容

### 添加徽章（Badges）

在 README.md 顶部添加：

```markdown
# 🚆✈️ Train & Flight Records Manager

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-8.0.0-green.svg)](CHANGELOG.md)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/你的用户名/train-flight-records-manager/pulls)
```

### 添加贡献指南

```markdown
## 🤝 贡献

欢迎贡献！请随意提交 Pull Request 或开 Issue。

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request
```

### 添加常见问题

```markdown
## ❓ 常见问题

**Q: 为什么地图不显示？**
A: 请确保已正确配置 `js/config.js` 中的地图 API Keys。

**Q: AI 问答功能不可用？**
A: 需要配置 AI API Key，详见配置步骤。

**Q: 数据存储在哪里？**
A: 所有数据存储在浏览器的 localStorage 中，完全离线。
```

## 🎯 最终检查

完成上述步骤后：

1. ✅ 本地测试应用是否正常运行
2. ✅ 检查 `.gitignore` 是否生效
3. ✅ 确认没有敏感信息被提交
4. ✅ README 和文档完善
5. ✅ 推送到 GitHub

## 📞 需要帮助？

如果遇到问题，请开 Issue 或联系维护者。
