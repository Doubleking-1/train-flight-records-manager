# 截图指南

## 📸 如何创建应用截图

为了让 README 展示效果最佳，请按以下步骤创建截图：

### 需要的截图

1. **homepage.png** - 主页地图概览
   - 打开 `index.html`
   - 确保显示了火车和飞机的路线
   - 使用 macOS 截图：`Cmd + Shift + 4`
   - 保存为 `screenshots/homepage.png`

2. **management.png** - 管理页面
   - 打开 `app.html`
   - 显示数据表格、统计面板
   - 截图保存为 `screenshots/management.png`

3. **charts.png** - 统计图表
   - 在 `app.html` 中切换到"统计"标签
   - 显示各种图表（年度、铁路局、车型等）
   - 截图保存为 `screenshots/charts.png`

4. **map-visualization.png** - 地图可视化
   - 在 `app.html` 中显示地图
   - 显示路线动画或多条路线
   - 截图保存为 `screenshots/map-visualization.png`

### 截图技巧

1. **分辨率**: 建议 1920x1080 或更高
2. **清晰度**: 确保文字清晰可读
3. **内容**: 包含实际数据，不要空白
4. **尺寸**: 压缩后每张不超过 500KB

### 截图后

1. 将截图文件放入 `screenshots/` 目录
2. 提交到 Git:
   ```bash
   git add screenshots/
   git commit -m "docs: 添加应用截图"
   git push
   ```

3. 刷新 GitHub 仓库页面，截图会自动显示在 README 中

### 可选：压缩图片

使用工具压缩图片以减小仓库大小：
- macOS: ImageOptim (https://imageoptim.com/)
- 在线工具: TinyPNG (https://tinypng.com/)

### 示例

好的截图应该：
- ✅ 显示应用的核心功能
- ✅ 包含真实的数据示例
- ✅ 界面完整，没有被裁切
- ✅ 配色和主题一致（建议使用暗色模式）

避免：
- ❌ 空白页面
- ❌ 加载中的状态
- ❌ 错误提示
- ❌ 分辨率过低
