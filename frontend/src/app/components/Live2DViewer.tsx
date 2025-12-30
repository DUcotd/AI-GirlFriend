"use client";

import { useEffect, useRef, useCallback, useState } from "react";

// Live2D 模型 URL (使用 Cubism 2 格式的 Shizuku 模型)
const MODEL_URL = "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json";

interface Live2DViewerProps {
    emotion?: string;
    width?: number;
    height?: number;
}

export default function Live2DViewer({
    emotion = "default",
    width = 280,
    height = 280
}: Live2DViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const appRef = useRef<any>(null);
    const modelRef = useRef<any>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 情绪到表情的映射
    const emotionToExpression: Record<string, number> = {
        default: 0,
        happy: 1,
        shy: 2,
        thinking: 3,
        sleepy: 4,
        sad: 5,
        angry: 6,
    };

    const initLive2D = useCallback(async () => {
        if (appRef.current || !canvasRef.current) return;

        try {
            // 动态导入
            const PIXI = await import("pixi.js") as any;
            const { Live2DModel } = await import("pixi-live2d-display") as any;

            // 注册 Ticker
            Live2DModel.registerTicker(PIXI.Ticker);

            // 创建 PIXI 应用 (v6 API)
            const app = new PIXI.Application({
                view: canvasRef.current,
                width,
                height,
                transparent: true,
                antialias: true,
                resolution: 1,
            });

            appRef.current = app;

            // 加载模型
            console.log("[Live2D] Loading model...");
            const model = await Live2DModel.from(MODEL_URL);

            modelRef.current = model;

            // 调整模型
            model.scale.set(0.25);
            model.anchor.set(0.5, 0.5);
            model.x = width / 2;
            model.y = height / 2 + 40;

            // 禁用交互避免错误
            model.interactive = false;
            model.buttonMode = false;

            app.stage.addChild(model);
            setIsLoaded(true);

            console.log("[Live2D] Model loaded successfully");
        } catch (err: any) {
            console.error("[Live2D] Error:", err);
            setError(err.message || "加载失败");
        }
    }, [width, height]);

    useEffect(() => {
        // 延迟初始化，等待 Cubism 运行时加载
        const timer = setTimeout(() => {
            initLive2D();
        }, 500);

        return () => {
            clearTimeout(timer);
            if (appRef.current) {
                appRef.current.destroy(true);
                appRef.current = null;
                modelRef.current = null;
            }
        };
    }, [initLive2D]);

    // 表情切换
    useEffect(() => {
        if (modelRef.current && isLoaded) {
            const expressionIndex = emotionToExpression[emotion] ?? 0;
            try {
                modelRef.current.internalModel?.motionManager?.expressionManager?.setExpression(expressionIndex);
            } catch (e) {
                // 忽略不支持的表情
            }
        }
    }, [emotion, isLoaded]);

    // 点击播放动作
    const handleClick = () => {
        if (modelRef.current) {
            try {
                modelRef.current.motion("tap_body");
            } catch (e) {
                // 忽略
            }
        }
    };

    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                <span>😢 {error}</span>
            </div>
        );
    }

    return (
        <div
            className="relative cursor-pointer"
            onClick={handleClick}
            title="点击互动"
        >
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                style={{
                    width: `${width}px`,
                    height: `${height}px`,
                }}
            />
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-gray-400 text-sm animate-pulse">加载中...</div>
                </div>
            )}
        </div>
    );
}
