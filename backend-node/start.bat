@echo off
chcp 65001 >nul
echo ========================================
echo    AI Girlfriend Backend 启动脚本
echo ========================================
echo.

:: 检查并关闭占用8000端口的进程
echo [1/2] 检查 8000 端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo 发现占用端口的进程 PID: %%a，正在关闭...
    taskkill /PID %%a /F >nul 2>&1
)
echo 端口 8000 已清理完毕！
echo.

:: 进入项目目录并启动服务
echo [2/2] 启动服务器...
cd /d "%~dp0"
npm run dev
