"use client";

import { useState, useEffect } from "react";
import { Settings, MessageSquare, Mic, Brain, ShieldAlert, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";

interface SettingsDialogProps {
    onClose: () => void;
    backendUrl: string;
    onConfigChange?: (config: { ttsEngine: "openai" | "local" }) => void;
}

export default function SettingsDialog({ onClose, backendUrl, onConfigChange }: SettingsDialogProps) {
    const [apiKey, setApiKey] = useState("");
    const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
    const [modelName, setModelName] = useState("gpt-3.5-turbo");
    const [ttsApiKey, setTtsApiKey] = useState("");
    const [ttsEngine, setTtsEngine] = useState<"openai" | "local">("openai");
    const [embApiKey, setEmbApiKey] = useState("");
    const [embBaseUrl, setEmbBaseUrl] = useState("https://api.siliconflow.cn/v1");
    const [embModelName, setEmbModelName] = useState("BAAI/bge-large-zh-v1.5");
    const [activeTab, setActiveTab] = useState<"general" | "voice" | "memory" | "proactive" | "advanced">("general");
    const [isLoading, setIsLoading] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // 主动消息配置
    const [proactiveEnabled, setProactiveEnabled] = useState(true);
    const [frequencyLevel, setFrequencyLevel] = useState<"low" | "medium" | "high">("medium");
    const [customDailyLimit, setCustomDailyLimit] = useState<number | null>(null);
    const [enabledTypes, setEnabledTypes] = useState<string[]>([
        'morning_greeting', 'night_greeting', 'task_reminder',
        'random_chat', 'miss_you', 'mood_check', 'memory_share'
    ]);
    const [availableTypes, setAvailableTypes] = useState<{ id: string, label: string, description: string }[]>([]);

    const { showToast, ToastContainer } = useToast();

    useEffect(() => {
        // 读取本地配置
        setApiKey(localStorage.getItem("apiKey") || "");
        setBaseUrl(localStorage.getItem("baseUrl") || "https://api.openai.com/v1");
        setModelName(localStorage.getItem("modelName") || "gpt-3.5-turbo");
        setTtsApiKey(localStorage.getItem("ttsApiKey") || "");
        setTtsEngine((localStorage.getItem("ttsEngine") as "openai" | "local") || "openai");
        setEmbApiKey(localStorage.getItem("embApiKey") || "");
        setEmbBaseUrl(localStorage.getItem("embBaseUrl") || "https://api.siliconflow.cn/v1");
        setEmbModelName(localStorage.getItem("embModelName") || "BAAI/bge-large-zh-v1.5");

        // 从 localStorage 读取主动消息配置
        const savedProactiveEnabled = localStorage.getItem("proactiveEnabled");
        if (savedProactiveEnabled !== null) setProactiveEnabled(savedProactiveEnabled === 'true');
        const savedFrequencyLevel = localStorage.getItem("frequencyLevel");
        if (savedFrequencyLevel) setFrequencyLevel(savedFrequencyLevel as "low" | "medium" | "high");
        const savedDailyLimit = localStorage.getItem("customDailyLimit");
        if (savedDailyLimit) setCustomDailyLimit(savedDailyLimit === 'null' ? null : parseInt(savedDailyLimit));
        const savedEnabledTypes = localStorage.getItem("enabledTypes");
        if (savedEnabledTypes) setEnabledTypes(JSON.parse(savedEnabledTypes));

        // 从后端获取主动消息配置
        fetchProactiveConfig();
    }, []);

    const fetchProactiveConfig = async () => {
        try {
            const res = await fetch(`${backendUrl}/config/proactive`);
            if (res.ok) {
                const data = await res.json();
                if (data.config) {
                    setProactiveEnabled(data.config.enabled);
                    setFrequencyLevel(data.config.frequencyLevel);
                    setCustomDailyLimit(data.config.customDailyLimit);
                    setEnabledTypes(data.config.enabledTypes || []);
                }
                if (data.availableTypes) {
                    setAvailableTypes(data.availableTypes);
                }
            }
        } catch (e) {
            console.error("Failed to fetch proactive config:", e);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        // 保存到本地
        localStorage.setItem("apiKey", apiKey);
        localStorage.setItem("baseUrl", baseUrl);
        localStorage.setItem("modelName", modelName);
        localStorage.setItem("ttsApiKey", ttsApiKey);
        localStorage.setItem("ttsEngine", ttsEngine);
        localStorage.setItem("embApiKey", embApiKey);
        localStorage.setItem("embBaseUrl", embBaseUrl);
        localStorage.setItem("embModelName", embModelName);

        // 保存主动消息配置到本地
        localStorage.setItem("proactiveEnabled", proactiveEnabled.toString());
        localStorage.setItem("frequencyLevel", frequencyLevel);
        localStorage.setItem("customDailyLimit", customDailyLimit === null ? 'null' : customDailyLimit.toString());
        localStorage.setItem("enabledTypes", JSON.stringify(enabledTypes));

        try {
            // 同步到后端
            await fetch(`${backendUrl}/config`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    api_key: apiKey,
                    base_url: baseUrl,
                    model_name: modelName,
                    tts_api_key: ttsApiKey || undefined,
                    embedding_api_key: embApiKey || undefined,
                    embedding_base_url: embBaseUrl || undefined,
                    embedding_model_name: embModelName || undefined,
                }),
            });

            // 同步主动消息配置到后端
            await fetch(`${backendUrl}/config/proactive`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: proactiveEnabled,
                    frequencyLevel,
                    customDailyLimit,
                    enabledTypes,
                }),
            });

            if (onConfigChange) {
                onConfigChange({ ttsEngine });
            }

            showToast("设置已保存并同步! ✨", "success");
            onClose();
        } catch (e) {
            showToast("保存失败，请检查后端连接", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetAll = async () => {
        try {
            await fetch(`${backendUrl}/history`, { method: "DELETE" });
            localStorage.removeItem("affinity");
            showToast("小爱已完全重置！", "success");
            setTimeout(() => window.location.reload(), 1000);
        } catch (e) {
            showToast("重置失败", "error");
        }
        setShowResetConfirm(false);
    };

    const tabs = [
        { id: "general", label: "通用", icon: MessageSquare },
        { id: "voice", label: "语音", icon: Mic },
        { id: "memory", label: "记忆", icon: Brain },
        { id: "proactive", label: "主动", icon: Bell },
        { id: "advanced", label: "系统", icon: ShieldAlert },
    ];

    return (
        <>
            <div className="modal-glass p-0 overflow-hidden w-[520px] max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="px-6 py-4 border-b border-pink-100/50 flex justify-between items-center bg-white/40">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-pink-600">
                        <Settings size={22} className="animate-spin-slow" /> 系统设置
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-pink-100/50 text-gray-400 hover:text-pink-500 transition-all"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-32 bg-pink-50/30 border-r border-pink-100/50 p-3 flex flex-col gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex flex-col items-center justify-center py-3 rounded-2xl transition-all gap-1.5 ${activeTab === tab.id
                                    ? "bg-white text-pink-600 shadow-sm border border-pink-100"
                                    : "text-gray-400 hover:bg-white/50 hover:text-pink-400"
                                    }`}
                            >
                                <tab.icon size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 bg-white/20 custom-scrollbar">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-5"
                            >
                                {activeTab === "general" && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">API Key</label>
                                            <input
                                                type="password"
                                                value={apiKey}
                                                onChange={(e) => setApiKey(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                                placeholder="sk-..."
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Base URL</label>
                                            <input
                                                type="text"
                                                value={baseUrl}
                                                onChange={(e) => setBaseUrl(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                                placeholder="https://api.openai.com/v1"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">模型名称</label>
                                            <input
                                                type="text"
                                                value={modelName}
                                                onChange={(e) => setModelName(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                                placeholder="gpt-3.5-turbo"
                                            />
                                        </div>
                                    </>
                                )}

                                {activeTab === "voice" && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">语音引擎</label>
                                            <div className="flex gap-2 p-1 bg-gray-100/50 rounded-2xl border border-gray-100">
                                                <button
                                                    onClick={() => setTtsEngine("openai")}
                                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${ttsEngine === "openai" ? "bg-white text-pink-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                                                        }`}
                                                >
                                                    OpenAI (云端)
                                                </button>
                                                <button
                                                    onClick={() => setTtsEngine("local")}
                                                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${ttsEngine === "local" ? "bg-white text-pink-600 shadow-sm" : "text-gray-400 hover:text-gray-500"
                                                        }`}
                                                >
                                                    浏览器 (本地)
                                                </button>
                                            </div>
                                        </div>
                                        {ttsEngine === "openai" && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-1"
                                            >
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">
                                                    TTS API Key <span className="text-pink-300 normal-case">(仅支持 OpenAI 官方 Key)</span>
                                                </label>
                                                <input
                                                    type="password"
                                                    value={ttsApiKey}
                                                    onChange={(e) => setTtsApiKey(e.target.value)}
                                                    className="input-cute py-2.5 text-sm bg-white/80"
                                                    placeholder="sk-... (不填则尝试主 Key)"
                                                />
                                            </motion.div>
                                        )}
                                        <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-[11px] text-blue-500 leading-relaxed">
                                            💡 提示：本地引擎完全免费且零延迟，但音色取决于你的系统配置；云端引擎音色更自然但需要消耗额度。
                                        </div>
                                    </>
                                )}

                                {activeTab === "memory" && (
                                    <>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Embedding API Key</label>
                                            <input
                                                type="password"
                                                value={embApiKey}
                                                onChange={(e) => setEmbApiKey(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                                placeholder="sk-... (留空则使用主 Key)"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Embedding Base URL</label>
                                            <input
                                                type="text"
                                                value={embBaseUrl}
                                                onChange={(e) => setEmbBaseUrl(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                                placeholder="https://api.siliconflow.cn/v1"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Embedding 模型名称</label>
                                            <input
                                                type="text"
                                                value={embModelName}
                                                onChange={(e) => setEmbModelName(e.target.value)}
                                                className="input-cute py-2.5 text-sm bg-white/80"
                                            />
                                        </div>
                                        <div className="p-4 bg-pink-50/50 rounded-2xl border border-pink-100 text-[11px] text-pink-500 leading-relaxed">
                                            🧠 记忆引擎让小爱具备语义搜索能力。推荐使用硅基流动等服务，能让小爱更精准地回忆起之前的谈话。
                                        </div>
                                    </>
                                )}

                                {activeTab === "proactive" && (
                                    <>
                                        {/* 总开关 */}
                                        <div className="flex items-center justify-between p-4 bg-white/50 rounded-2xl border border-pink-100">
                                            <div>
                                                <h4 className="text-sm font-bold text-gray-700">启用主动消息</h4>
                                                <p className="text-[10px] text-gray-400 mt-0.5">小爱会根据时间和场景主动找你聊天</p>
                                            </div>
                                            <button
                                                onClick={() => setProactiveEnabled(!proactiveEnabled)}
                                                className={`w-12 h-6 rounded-full transition-all relative ${proactiveEnabled ? 'bg-pink-400' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${proactiveEnabled ? 'right-1' : 'left-1'}`} />
                                            </button>
                                        </div>

                                        {proactiveEnabled && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-5"
                                            >
                                                {/* 频率选择 */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">消息频率</label>
                                                    <div className="flex gap-2 p-1 bg-gray-100/50 rounded-2xl border border-gray-100">
                                                        {(['low', 'medium', 'high'] as const).map((level) => (
                                                            <button
                                                                key={level}
                                                                onClick={() => setFrequencyLevel(level)}
                                                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${frequencyLevel === level ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-400 hover:text-gray-500'}`}
                                                            >
                                                                {level === 'low' ? '🐢 低频' : level === 'medium' ? '🐰 中频' : '🚀 高频'}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 pl-1">
                                                        {frequencyLevel === 'low' && '安静模式：减少消息打扰，冷却时间加倍'}
                                                        {frequencyLevel === 'medium' && '平衡模式：适度互动（默认推荐）'}
                                                        {frequencyLevel === 'high' && '活跃模式：更频繁的互动，适合想要陪伴的时刻'}
                                                    </p>
                                                </div>

                                                {/* 每日上限 */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">每日消息上限</label>
                                                        <button
                                                            onClick={() => setCustomDailyLimit(customDailyLimit === null ? 8 : null)}
                                                            className={`text-[10px] px-2 py-1 rounded-lg transition-all ${customDailyLimit !== null ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}
                                                        >
                                                            {customDailyLimit !== null ? '自定义' : '自动（按好感度）'}
                                                        </button>
                                                    </div>
                                                    {customDailyLimit !== null && (
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="range"
                                                                min="1"
                                                                max="20"
                                                                value={customDailyLimit}
                                                                onChange={(e) => setCustomDailyLimit(parseInt(e.target.value))}
                                                                className="flex-1 accent-pink-400"
                                                            />
                                                            <span className="text-sm font-bold text-pink-600 min-w-[3rem] text-right">{customDailyLimit} 条/天</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 消息类型 */}
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">消息类型</label>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        {availableTypes.map((type) => (
                                                            <label
                                                                key={type.id}
                                                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${enabledTypes.includes(type.id) ? 'bg-pink-50 border border-pink-200' : 'bg-white/50 border border-gray-100 hover:border-gray-200'}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={enabledTypes.includes(type.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) {
                                                                            setEnabledTypes([...enabledTypes, type.id]);
                                                                        } else {
                                                                            setEnabledTypes(enabledTypes.filter(t => t !== type.id));
                                                                        }
                                                                    }}
                                                                    className="w-4 h-4 accent-pink-400"
                                                                />
                                                                <div className="flex-1">
                                                                    <span className="text-sm font-medium text-gray-700">{type.label}</span>
                                                                    <p className="text-[10px] text-gray-400">{type.description}</p>
                                                                </div>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 text-[11px] text-purple-500 leading-relaxed">
                                            💝 主动消息让小爱更加主动关心你！她会在合适的时间发送问候、想念消息和情绪关怀。
                                        </div>
                                    </>
                                )}

                                {activeTab === "advanced" && (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-red-50/30 rounded-2xl border border-red-100 space-y-3">
                                            <h4 className="text-xs font-bold text-red-500 flex items-center gap-1">
                                                <ShieldAlert size={14} /> 危险操作
                                            </h4>
                                            <button
                                                onClick={() => setShowResetConfirm(true)}
                                                className="w-full py-2.5 rounded-xl border border-red-200 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                            >
                                                🔄 完全重置小爱 (不可逆)
                                            </button>
                                            <p className="text-[10px] text-red-400 text-center">
                                                这将清空所有对话历史、向量化存储和角色好感度。
                                            </p>
                                        </div>

                                        <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-2 text-[11px] text-gray-500 italic">
                                            <p>后端 API 版本: v1.2.0-stable</p>
                                            <p>前端核心版本: Next.js 15 (Turbopack)</p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-pink-100/30 bg-white/40 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="btn-cute px-8 py-2.5 text-sm shadow-pink-200 min-w-[120px]"
                    >
                        {isLoading ? "保存中..." : "保存全部配置"}
                    </button>
                </div>
            </div>

            {/* Toast 通知 */}
            <ToastContainer />

            {/* 确认对话框 */}
            <ConfirmDialog
                isOpen={showResetConfirm}
                title="完全重置小爱"
                message="确定要完全重置小爱吗？\n这将清除所有聊天记录、记忆和好感度！\n此操作无法撤销！"
                confirmText="确认重置"
                cancelText="取消"
                type="danger"
                onConfirm={handleResetAll}
                onCancel={() => setShowResetConfirm(false)}
            />
        </>
    );
}
