@echo off
chcp 65001 >nul
echo ========================================
echo    AI Girlfriend 一键启动脚本
echo    前端: http://localhost:3000
echo    后端: http://localhost:8000
echo ========================================
echo.

:: 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js v18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查依赖是否已安装
set NEED_INSTALL=0

if not exist "%~dp0backend-node\node_modules" (
    echo [警告] 后端依赖未安装
    set NEED_INSTALL=1
)

if not exist "%~dp0frontend\node_modules" (
    echo [警告] 前端依赖未安装
    set NEED_INSTALL=1
)

if %NEED_INSTALL%==1 (
    echo.
    echo [提示] 检测到依赖未安装，正在自动安装...
    echo.
    
    :: 安装后端依赖
    if not exist "%~dp0backend-node\node_modules" (
        echo [1/2] 安装后端依赖...
        cd /d "%~dp0backend-node"
        call npm install
        if %errorlevel% neq 0 (
            echo [错误] 后端依赖安装失败！
            pause
            exit /b 1
        )
        echo [成功] 后端依赖安装完成！
        echo.
    )
    
    :: 安装前端依赖
    if not exist "%~dp0frontend\node_modules" (
        echo [2/2] 安装前端依赖...
        cd /d "%~dp0frontend"
        call npm install
        if %errorlevel% neq 0 (
            echo [错误] 前端依赖安装失败！
            pause
            exit /b 1
        )
        echo [成功] 前端依赖安装完成！
        echo.
    )
)

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
echo ========================================
echo    ✓ 前后端已在新窗口中启动！
echo    前端: http://localhost:3000
echo    后端: http://localhost:8000
echo ========================================
echo   按任意键关闭此窗口...
pause >nul
