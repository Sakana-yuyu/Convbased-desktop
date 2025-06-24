# Convbased Desktop

一个基于 Electron 的桌面应用程序，将 Convbased 网页版封装为独立的桌面应用，支持系统托盘功能。

## 功能特性

- 🖥️ **独立桌面应用**: 将 https://weights.chat 封装为原生桌面应用
- 🔔 **系统托盘支持**: 最小化到系统托盘，后台运行
- 🌐 **现代浏览器内核**: 基于 Chromium 内核，完全兼容网页功能
- 🔒 **安全性**: 启用上下文隔离和安全策略
- ⚡ **单实例运行**: 防止重复启动，自动聚焦已运行的实例
- 🎨 **原生界面**: 符合操作系统设计规范的界面

## 系统要求

- Windows 10/11 (64位)
- 至少 4GB RAM
- 100MB 可用磁盘空间

## 安装和运行

### 开发环境

1. **安装 Node.js**
   - 下载并安装 [Node.js](https://nodejs.org/) (推荐 LTS 版本)

2. **安装依赖**
   ```bash
   npm install
   ```

3. **开发模式运行**
   ```bash
   npm run dev
   ```

4. **正常模式运行**
   ```bash
   npm start
   ```

### 构建可执行文件

1. **构建 Windows 安装包**
   ```bash
   npm run build-win
   ```

2. **构建所有平台**
   ```bash
   npm run build
   ```

构建完成后，可执行文件将在 `dist` 目录中生成。

## 使用说明

### 基本操作

- **启动应用**: 双击桌面图标或从开始菜单启动
- **最小化到托盘**: 点击窗口关闭按钮（X）
- **从托盘恢复**: 双击系统托盘图标
- **托盘菜单**: 右键点击托盘图标查看选项
- **完全退出**: 从托盘菜单选择"退出"

### 快捷键

- `Ctrl + R` 或 `F5`: 刷新页面
- `Esc`: 最小化到托盘
- `Ctrl + Shift + I`: 打开开发者工具（开发模式）

### 托盘功能

- **显示主窗口**: 恢复应用窗口
- **重新加载**: 刷新网页内容
- **开发者工具**: 打开调试工具
- **退出**: 完全关闭应用

## 技术架构

### 核心技术

- **Electron**: 跨平台桌面应用框架
- **Chromium**: 现代浏览器内核
- **Node.js**: 后端运行时

### 项目结构

```
convbased-desktop/
├── main.js              # 主进程文件
├── preload.js           # 预加载脚本
├── package.json         # 项目配置
├── assets/              # 资源文件
│   ├── icon.svg         # 应用图标
│   └── tray-icon.svg    # 托盘图标
└── dist/                # 构建输出目录
```

### 安全特性

- **上下文隔离**: 渲染进程与主进程完全隔离
- **禁用 Node.js 集成**: 防止网页直接访问系统API
- **安全的 IPC 通信**: 通过预加载脚本安全暴露API
- **外链保护**: 自动在默认浏览器中打开外部链接

## 自定义配置

### 修改目标网址

在 `main.js` 文件中修改以下行：

```javascript
mainWindow.loadURL('https://weights.chat/#/auth/register?code=6UMCRj');
```

### 修改应用图标

替换 `assets/` 目录中的图标文件：
- `icon.svg`: 应用主图标
- `tray-icon.svg`: 系统托盘图标

### 修改窗口设置

在 `main.js` 的 `createWindow()` 函数中调整窗口参数：

```javascript
mainWindow = new BrowserWindow({
  width: 1200,        // 窗口宽度
  height: 800,        // 窗口高度
  minWidth: 800,      // 最小宽度
  minHeight: 600,     // 最小高度
  // ... 其他设置
});
```

## 故障排除

### 常见问题

1. **应用无法启动**
   - 检查 Node.js 是否正确安装
   - 运行 `npm install` 重新安装依赖

2. **网页加载失败**
   - 检查网络连接
   - 确认目标网址是否可访问

3. **托盘图标不显示**
   - 检查系统托盘设置
   - 确认图标文件是否存在

4. **构建失败**
   - 清理 node_modules: `rm -rf node_modules && npm install`
   - 检查磁盘空间是否充足

### 日志调试

开发模式下可以查看控制台输出：

```bash
npm run dev
```

## 更新日志

### v1.0.0
- 初始版本发布
- 基本的网页封装功能
- 系统托盘支持
- Windows 平台支持

## 许可证

MIT License - 详见 LICENSE 文件

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过以下方式联系：

- GitHub Issues: [项目地址]
- Email: [2129005038@qq.com]

---

**注意**: 本应用仅为 Convbased 的桌面封装版本，不隶属于 Convbased 官方。