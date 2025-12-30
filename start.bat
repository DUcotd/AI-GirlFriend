@echo off
chcp 65001 >nul
echo ========================================
echo    AI Girlfriend 一键启动脚本
echo    前端: http://localhost:3000
echo    后端: http://localhost:8000
echo ========================================
echo.

:: 检查并关闭占用8000端口的进程
echo [1/3] 清理 8000 端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)

:: 检查并关闭占用3000端口的进程
echo [2/3] 清理 3000 端口...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo 端口已清理完毕！
echo.

:: 启动后端（新窗口）
echo [3/3] 启动服务...
start "AI Girlfriend - Backend" cmd /k "cd /d %~dp0backend-node && npm run dev"

:: 等待后端启动
timeout /t 2 /nobreak >nul

:: 启动前端（新窗口）
start "AI Girlfriend - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ✓ 前后端已在新窗口中启动！
echo   按任意键关闭此窗口...
pause >nul
