# 贡献指南

感谢您对本项目的关注！欢迎提交 Pull Request 或 Issue。

## 🤝 如何贡献

### 报告 Bug

1. 在 [Issues](https://github.com/你的用户名/train-flight-records-manager/issues) 页面创建新 Issue
2. 描述问题并提供复现步骤
3. 如果可能，提供截图或错误信息

### 提交功能建议

1. 在 Issues 中创建 Feature Request
2. 详细描述您期望的功能
3. 如果有设计想法，可以附上说明

### 提交代码

1. **Fork 本仓库**
   ```bash
   # 在 GitHub 页面点击 Fork 按钮
   ```

2. **克隆到本地**
   ```bash
   git clone https://github.com/你的用户名/train-flight-records-manager.git
   cd train-flight-records-manager
   ```

3. **配置环境**
   ```bash
   # 复制配置文件
   cp js/config.example.js js/config.js
   # 填入你的 API Keys 用于测试
   ```

4. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **进行修改**
   - 保持代码风格一致
   - 添加必要的注释
   - 测试你的修改

6. **提交更改**
   ```bash
   git add .
   git commit -m "Add: 简短描述你的修改"
   ```

7. **推送到 GitHub**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **创建 Pull Request**
   - 在 GitHub 上打开你的 Fork
   - 点击 "New Pull Request"
   - 描述你的修改内容

## 📝 代码规范

- 使用有意义的变量和函数名
- 添加必要的注释（中文）
- 保持代码简洁可读
- 新增功能请更新相关文档

## 🔒 安全提醒

- **不要提交真实的 API Keys**
- 确保 `js/config.js` 在 `.gitignore` 中
- 使用 `js/config.example.js` 作为示例

## ❓ 需要帮助？

如果有任何问题，欢迎：
- 创建 Issue 讨论
- 查看现有的 Issue 和 PR
- 阅读 README.md 和 CHANGELOG.md

感谢您的贡献！🎉
