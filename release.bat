@echo off
chcp 65001 >nul
echo 🚀 Electron 应用自动发布工具
echo.

if "%1"=="" (
    echo 使用方法: release.bat ^<版本号^>
    echo 例如: release.bat 1.3.5
    echo.
    node scripts/release.js
    pause
    exit /b 1
)

node scripts/release.js %1
pause