@echo off
chcp 65001 >nul
echo ========================================
echo    AI Girlfriend 停止脚本
echo ========================================
echo.

:: 关闭占用8000端口的进程
echo [1/2] 停止后端服务 (8000端口)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo       已停止 PID: %%a
)

:: 关闭占用3000端口的进程
echo [2/2] 停止前端服务 (3000端口)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
    echo       已停止 PID: %%a
)

echo.
echo ✓ 所有服务已停止！
timeout /t 2 >nul
