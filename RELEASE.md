# 🚀 自动发布指南

本项目已配置 GitHub Actions 自动发布功能，可以自动构建并发布 Electron 应用到 GitHub Releases。

## 📋 前置要求

1. **GitHub 仓库**: 确保项目已推送到 GitHub
2. **GitHub Token**: Actions 会自动使用 `GITHUB_TOKEN`，无需额外配置
3. **Git 配置**: 确保本地 Git 已正确配置用户信息

## 🎯 发布方式

### 方式一：使用发布脚本（推荐）

```bash
# 使用 npm 脚本
npm run release 1.3.5

# 或直接运行脚本
node scripts/release.js 1.3.5

# Windows 用户可以使用批处理文件
release.bat 1.3.5
```

### 方式二：使用 npm version 命令

```bash
# 补丁版本 (1.0.0 -> 1.0.1)
npm run release:patch

# 次要版本 (1.0.0 -> 1.1.0)
npm run release:minor

# 主要版本 (1.0.0 -> 2.0.0)
npm run release:major
```

### 方式三：手动创建标签

```bash
# 更新版本号
npm version 1.3.5

# 创建标签
git tag -a v1.3.5 -m "Release v1.3.5"

# 推送标签
git push origin v1.3.5
```

### 方式四：GitHub 手动触发

1. 访问 GitHub 仓库的 Actions 页面
2. 选择 "Build and Release" 工作流
3. 点击 "Run workflow"
4. 输入版本号并运行

## 📦 构建产物

自动发布会为以下平台生成安装包：

- **Windows**: `.exe` 安装包
- **macOS**: `.dmg` 安装包
- **Linux**: `.AppImage` 便携版

## 🔧 配置说明

### GitHub Actions 工作流

文件位置: `.github/workflows/release.yml`

- **触发条件**: 推送 `v*.*.*` 格式的标签或手动触发
- **构建平台**: Windows、macOS、Linux
- **自动发布**: 构建完成后自动创建 GitHub Release

### Electron Builder 配置

配置位置: `package.json` 中的 `build` 字段

```json
{
  "build": {
    "appId": "com.convn.app",
    "productName": "Convn",
    "directories": {
      "output": "dist"
    },
    "files": [
      "**/*",
      "!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}",
      "!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}",
      "!**/node_modules/*.d.ts",
      "!**/node_modules/.bin",
      "!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}",
      "!.editorconfig",
      "!**/._*",
      "!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}",
      "!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}",
      "!**/{appveyor.yml,.travis.yml,circle.yml}",
      "!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}"
    ],
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    }
  }
}
```

## 🚨 注意事项

1. **版本号格式**: 必须使用语义化版本号 (如 1.3.5)
2. **标签格式**: Git 标签必须以 `v` 开头 (如 v1.3.5)
3. **权限要求**: 需要仓库的写入权限才能创建 Release
4. **构建时间**: 多平台构建可能需要 10-20 分钟
5. **网络要求**: 构建过程需要下载依赖，确保网络稳定

## 🔍 故障排除

### 构建失败

1. 检查 GitHub Actions 日志
2. 确认 `package.json` 配置正确
3. 验证依赖是否完整

### 发布失败

1. 检查 GitHub Token 权限
2. 确认标签格式正确
3. 验证仓库设置允许创建 Release

### 本地脚本失败

1. 确认 Node.js 环境正常
2. 检查 Git 配置和权限
3. 验证网络连接

## 📚 相关链接

- [Electron Builder 文档](https://www.electron.build/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [语义化版本规范](https://semver.org/lang/zh-CN/)