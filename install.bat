@echo off
chcp 65001 >nul
echo ========================================
echo    AI Girlfriend 依赖安装脚本
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

:: 显示 Node.js 版本
echo [信息] Node.js 版本:
node -v
echo.

:: 安装后端依赖
echo [1/2] 安装后端依赖...
cd /d "%~dp0backend-node"
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 后端依赖安装失败！
        pause
        exit /b 1
    )
    echo [成功] 后端依赖安装完成！
) else (
    echo [跳过] 后端 node_modules 已存在
)
echo.

:: 安装前端依赖
echo [2/2] 安装前端依赖...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 前端依赖安装失败！
        pause
        exit /b 1
    )
    echo [成功] 前端依赖安装完成！
) else (
    echo [跳过] 前端 node_modules 已存在
)
echo.

echo ========================================
echo    ✓ 所有依赖安装完成！
echo    现在可以运行 start.bat 启动项目
echo ========================================
pause
