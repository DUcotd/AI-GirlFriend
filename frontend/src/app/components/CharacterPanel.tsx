"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import dynamic from "next/dynamic";

// 动态导入 Live2D 组件 (避免 SSR)
const Live2DViewer = dynamic(() => import("./Live2DViewer"), {
    ssr: false,
    loading: () => <div className="w-48 h-48 flex items-center justify-center text-gray-400">加载中...</div>
});

interface CharacterPanelProps {
    emotion: "default" | "happy" | "shy" | "thinking" | "sleepy" | "sad" | "angry";
    affinity: number; // 0-100
    currentActivity?: { activity: string; emoji: string } | null;
    emotionalState?: {
        current: { P: number; A: number; D: number };
        label: string;
        style: { guide: string };
    };
}

const emotionImages: Record<string, string> = {
    default: "/characters/default.png",
    happy: "/characters/happy.png",
    shy: "/characters/shy.png",
    thinking: "/characters/thinking.png",
    sleepy: "/characters/sleepy.png",
    sad: "/characters/sad.png",
    angry: "/characters/angry.png",
};

const emotionEmojis: Record<string, string> = {
    default: "😊",
    happy: "😆",
    shy: "😳",
    thinking: "🤔",
    sleepy: "😴",
    sad: "😢",
    angry: "😤",
};

const emotionLabels: Record<string, string> = {
    default: "开心",
    happy: "超开心",
    shy: "害羞",
    thinking: "思考中",
    sleepy: "困困的",
    sad: "难过",
    angry: "傲娇",
};

// 情绪映射表，处理 AI 可能返回的各种名称
const emotionMap: Record<string, string> = {
    "友好": "default",
    "开心": "happy",
    "害羞": "shy",
    "羞涩": "shy",
    "思考": "thinking",
    "困": "sleepy",
    "困倦": "sleepy",
    "难过": "sad",
    "伤心": "sad",
    "生气": "angry",
    "愤怒": "angry",
    "pleasant": "default",
    "friendly": "default",
};

export default function CharacterPanel({ emotion, affinity, currentActivity, emotionalState }: CharacterPanelProps) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [currentEmotion, setCurrentEmotion] = useState(emotion);
    const [useLive2D, setUseLive2D] = useState(false); // 默认使用静态图

    useEffect(() => {
        // 解析和规范化情绪
        const normalizedEmotion = (emotionMap[emotion] || (emotionImages[emotion] ? emotion : "default")) as any;
        setCurrentEmotion(normalizedEmotion);
    }, [emotion]);

    // 计算好感度等级 (5颗心)
    const hearts = Array.from({ length: 5 }, (_, i) => {
        const threshold = (i + 1) * 20;
        return affinity >= threshold;
    });

    // 获取好感度称呼
    const getAffinityTitle = () => {
        if (affinity >= 80) return "最爱的人";
        if (affinity >= 60) return "亲密恋人";
        if (affinity >= 40) return "甜蜜约会";
        if (affinity >= 20) return "好感上升";
        return "初次相识";
    };

    return (
        <div className="card-cute p-6 h-full flex flex-col">
            {/* 角色名称 */}
            <div className="text-center mb-4">
                <h2 className="text-2xl font-bold gradient-text">小爱 Xiao Ai</h2>
                <p className="text-sm text-gray-500 mt-1">
                    {getAffinityTitle()} · {emotionLabels[currentEmotion]}
                </p>
            </div>

            {/* 好感度心形 */}
            <div className="flex justify-center gap-1 mb-4">
                {hearts.map((filled, idx) => (
                    <span
                        key={idx}
                        className={`affinity-heart ${filled ? "filled" : "empty"}`}
                        style={{ animationDelay: `${idx * 0.1}s` }}
                    >
                        {filled ? "❤️" : "🤍"}
                    </span>
                ))}
            </div>

            {/* 好感度进度条 */}
            <div className="mb-6">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>好感度</span>
                    <span>{affinity}/100</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                            width: `${affinity}%`,
                            background: "linear-gradient(90deg, #ffb7c5, #ff6b8a)",
                        }}
                    />
                </div>
            </div>

            {/* 角色立绘 */}
            <div className="flex-1 flex items-center justify-center relative character-container">
                {/* 背景装饰 */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-pink-200/30 to-purple-200/30 blur-2xl" />
                </div>

                {/* 角色图片/Live2D */}
                <div className="relative z-10 text-center">
                    {useLive2D ? (
                        <div className="w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center shadow-xl">
                            <Live2DViewer emotion={currentEmotion} width={192} height={192} />
                        </div>
                    ) : (
                        <div
                            className="w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-pink-100 to-purple-100 flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-105 cursor-pointer"
                            onClick={() => {
                                const emotions = ["default", "happy", "shy", "thinking", "sleepy", "sad", "angry"] as const;
                                const nextIdx = (emotions.indexOf(currentEmotion) + 1) % emotions.length;
                                setCurrentEmotion(emotions[nextIdx]);
                            }}
                        >
                            <img
                                src={emotionImages[currentEmotion]}
                                alt={`小爱 - ${emotionLabels[currentEmotion]}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-6xl">${emotionEmojis[currentEmotion]}</span>`;
                                }}
                            />
                        </div>
                    )}
                    <button
                        className="text-xs text-gray-400 mt-3 hover:text-pink-500 transition-colors"
                        onClick={() => setUseLive2D(!useLive2D)}
                    >
                        {useLive2D ? "切换为静态图" : "切换为 Live2D"} ✨
                    </button>
                </div>

                {/* 装饰性星星 */}
                <span className="star absolute top-4 right-4 text-xl">✨</span>
                <span className="star absolute bottom-8 left-4 text-xl" style={{ animationDelay: "0.5s" }}>💫</span>
                <span className="star absolute top-1/3 left-2 text-sm" style={{ animationDelay: "1s" }}>⭐</span>
            </div>

            {/* 情绪和活动状态标签 */}
            <div className="mt-4 flex justify-center gap-2 flex-wrap">
                <span className="emotion-badge">
                    {emotionEmojis[currentEmotion]} {emotionLabels[currentEmotion]}
                </span>
                {currentActivity && (
                    <span className="emotion-badge bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200">
                        {currentActivity.emoji} {currentActivity.activity}
                    </span>
                )}
                {emotionalState?.label && emotionalState.label !== emotionLabels[currentEmotion] && (
                    <span className="emotion-badge bg-blue-50 border-blue-200 text-blue-600">
                        💭 {emotionalState.label}
                    </span>
                )}
            </div>

            {/* 心理动力学详细状态 (Debug面板风格) */}
            {emotionalState && (
                <div className="mt-6 bg-gray-50/80 rounded-xl p-3 text-xs border border-gray-100">
                    <div className="text-gray-400 mb-2 font-medium flex justify-between">
                        <span>🧠 心理状态 (PAD Model)</span>
                        <span className="text-[10px] opacity-70">P/A/D System</span>
                    </div>

                    <div className="space-y-2">
                        {/* P Value */}
                        <div className="flex items-center gap-2">
                            <span className="w-4 text-center">{emotionalState.current.P > 0 ? "😄" : "😢"}</span>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${emotionalState.current.P > 0 ? "bg-green-400" : "bg-blue-400"}`}
                                    style={{ width: `${Math.abs(emotionalState.current.P) * 100}%`, marginLeft: emotionalState.current.P < 0 ? 0 : 'auto', marginRight: emotionalState.current.P > 0 ? 0 : 'auto' }}
                                />
                                {/* 注意：这种简单进度条无法完美表达 -1 到 1，简化为正负显示 */}
                            </div>
                            <span className="w-8 text-right font-mono text-gray-500">{emotionalState.current.P.toFixed(1)}</span>
                        </div>
                        {/* A Value */}
                        <div className="flex items-center gap-2">
                            <span className="w-4 text-center">{emotionalState.current.A > 0 ? "⚡" : "💤"}</span>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${emotionalState.current.A > 0 ? "bg-red-400" : "bg-purple-400"}`}
                                    style={{ width: `${Math.abs(emotionalState.current.A) * 100}%` }}
                                />
                            </div>
                            <span className="w-8 text-right font-mono text-gray-500">{emotionalState.current.A.toFixed(1)}</span>
                        </div>
                        {/* D Value */}
                        <div className="flex items-center gap-2">
                            <span className="w-4 text-center">{emotionalState.current.D > 0 ? "👑" : "🥺"}</span>
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${emotionalState.current.D > 0 ? "bg-amber-400" : "bg-pink-400"}`}
                                    style={{ width: `${Math.abs(emotionalState.current.D) * 100}%` }}
                                />
                            </div>
                            <span className="w-8 text-right font-mono text-gray-500">{emotionalState.current.D.toFixed(1)}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
