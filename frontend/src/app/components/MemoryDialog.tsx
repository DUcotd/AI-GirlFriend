"use client";

import { useState, useEffect } from "react";
import { Brain, Trash2, Heart, User, Loader2 } from "lucide-react";
import Toast, { useToast } from "./Toast";
import ConfirmDialog from "./ConfirmDialog";

interface Memory {
    id: string;
    text: string;
    timestamp: number;
}

interface MemoryDialogProps {
    onClose: () => void;
    backendUrl: string;
    onStateChange?: (state: { affinity: number; nickname: string }) => void;
}

export default function MemoryDialog({ onClose, backendUrl, onStateChange }: MemoryDialogProps) {
    const [memories, setMemories] = useState<Memory[]>([]);
    const [affinity, setAffinity] = useState(35);
    const [nickname, setNickname] = useState("亲爱的");
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"memories" | "settings">("memories");
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const { showToast, ToastContainer } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // 获取记忆
            const memRes = await fetch(`${backendUrl}/memories`);
            if (memRes.ok) {
                const data = await memRes.json();
                setMemories(data);
            }

            // 获取状态
            const stateRes = await fetch(`${backendUrl}/state`);
            if (stateRes.ok) {
                const state = await stateRes.json();
                setAffinity(state.affinity || 35);
                setNickname(state.nickname || "亲爱的");
            }
        } catch (e) {
            console.error("Failed to fetch data", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearMemories = async () => {
        try {
            await fetch(`${backendUrl}/memories`, { method: "DELETE" });
            setMemories([]);
            showToast("记忆已清除！小爱的聊天历史依然保留 ✨", "success");
        } catch (e) {
            showToast("清除失败", "error");
        }
        setShowClearConfirm(false);
    };

    const handleSaveSettings = async () => {
        try {
            const res = await fetch(`${backendUrl}/state`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ affinity, nickname }),
            });
            if (res.ok) {
                // Notify parent component
                if (onStateChange) {
                    onStateChange({ affinity, nickname });
                }
                showToast("设置已保存！✨", "success");
            }
        } catch (e) {
            showToast("保存失败", "error");
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString("zh-CN");
    };

    return (
        <>
            <div className="modal-glass p-6 w-[450px] max-h-[80vh] flex flex-col">
                {/* 标题 */}
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Brain size={20} className="text-pink-500" /> 小爱的记忆管理
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 标签页 */}
                <div className="flex gap-2 mb-4">
                    <button
                        onClick={() => setActiveTab("memories")}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "memories"
                            ? "bg-pink-100 text-pink-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        🧠 记忆列表
                    </button>
                    <button
                        onClick={() => setActiveTab("settings")}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === "settings"
                            ? "bg-pink-100 text-pink-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                    >
                        ⚙️ 修改设定
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8 text-gray-500">
                            <Loader2 className="animate-spin mr-2" size={20} />
                            加载中...
                        </div>
                    ) : activeTab === "memories" ? (
                        <div className="space-y-3">
                            {memories.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    小爱还没有形成长期记忆哦～
                                </div>
                            ) : (
                                memories.map((mem) => (
                                    <div
                                        key={mem.id}
                                        className="bg-pink-50/50 rounded-xl p-3 text-sm"
                                    >
                                        <p className="text-gray-700 whitespace-pre-wrap">{mem.text}</p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            {formatTime(mem.timestamp)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* 好感度调整 */}
                            <div className="bg-pink-50/50 rounded-xl p-4">
                                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <Heart size={16} className="text-pink-500" />
                                    好感度: {affinity}
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={affinity}
                                    onChange={(e) => setAffinity(Number(e.target.value))}
                                    className="w-full accent-pink-500"
                                />
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>陌生人</span>
                                    <span>恋人</span>
                                </div>
                            </div>

                            {/* 称呼调整 */}
                            <div className="bg-pink-50/50 rounded-xl p-4">
                                <label className="flex items-center gap-2 text-sm font-medium mb-3">
                                    <User size={16} className="text-pink-500" />
                                    小爱对你的称呼
                                </label>
                                <input
                                    type="text"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value)}
                                    className="input-cute py-2 text-sm"
                                    placeholder="例如：亲爱的、老公、主人..."
                                />
                            </div>

                            <button
                                onClick={handleSaveSettings}
                                className="btn-cute w-full py-2.5"
                            >
                                保存设定 ✨
                            </button>
                        </div>
                    )}
                </div>

                {/* 底部按钮 */}
                <div className="mt-4 pt-4 border-t border-pink-100">
                    <button
                        onClick={() => setShowClearConfirm(true)}
                        className="w-full py-2 text-sm text-orange-500 hover:bg-orange-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={16} />
                        清除记忆（保留聊天历史）
                    </button>
                </div>
            </div>

            {/* Toast 通知 */}
            <ToastContainer />

            {/* 确认对话框 */}
            <ConfirmDialog
                isOpen={showClearConfirm}
                title="清除记忆"
                message="确定要清除小爱的记忆吗？聊天历史会保留。"
                confirmText="确认清除"
                cancelText="取消"
                type="warning"
                onConfirm={handleClearMemories}
                onCancel={() => setShowClearConfirm(false)}
            />
        </>
    );
}
