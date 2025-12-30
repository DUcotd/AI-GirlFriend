/**
 * EmotionEngine - PAD三维情感模型 + 情绪惯性系统
 * 
 * PAD模型维度:
 * - P (Pleasure): 愉悦度 [-1, 1] 开心/痛苦
 * - A (Arousal): 激活度 [-1, 1] 兴奋/平静
 * - D (Dominance): 优势度 [-1, 1] 掌控/顺从
 */

import fs from 'fs';
import path from 'path';

class EmotionEngine {
    constructor(statePath = null) {
        // 持久化路径
        this.statePath = statePath || path.resolve(process.cwd(), '..', 'memory_db', 'emotion_state.json');

        // 基准性格 - AI的"本性"，情绪会向此回归
        this.baseline = {
            P: 0.3,   // 天性略乐观
            A: 0.1,   // 天性略活跃
            D: -0.1   // 天性略顺从/可爱
        };

        // 当前情绪状态
        this.state = {
            P: 0.3,
            A: 0.1,
            D: -0.1
        };

        // 情绪历史（用于分析趋势）
        this.history = [];
        this.maxHistory = 50;

        // 加载持久化状态
        this._loadState();
    }

    // ==================== 核心方法 ====================

    /**
     * 应用情绪变化（使用惯性叠加公式）
     * Current = Old * inertia + Delta * (1 - inertia)
     * @param {Object} delta - { P, A, D } 变化值
     * @param {number} inertia - 惯性系数 (0-1)，越高越难改变
     */
    applyDelta(delta, inertia = 0.7) {
        const oldState = { ...this.state };

        // 情绪叠加公式
        if (typeof delta.P === 'number') {
            this.state.P = this._clamp(this.state.P * inertia + delta.P * (1 - inertia));
        }
        if (typeof delta.A === 'number') {
            this.state.A = this._clamp(this.state.A * inertia + delta.A * (1 - inertia));
        }
        if (typeof delta.D === 'number') {
            this.state.D = this._clamp(this.state.D * inertia + delta.D * (1 - inertia));
        }

        // 记录历史
        this.history.push({
            timestamp: Date.now(),
            before: oldState,
            delta,
            after: { ...this.state }
        });

        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }

        this._saveState();

        console.log(`[Emotion] Delta applied: P:${delta.P?.toFixed(2) || 0} A:${delta.A?.toFixed(2) || 0} D:${delta.D?.toFixed(2) || 0}`);
        console.log(`[Emotion] New state: P:${this.state.P.toFixed(2)} A:${this.state.A.toFixed(2)} D:${this.state.D.toFixed(2)}`);

        return this.state;
    }

    /**
     * 情绪衰减 - 向基准性格回归
     * 模拟情绪的"半衰期"效应
     * @param {number} rate - 衰减率 (0.05-0.15)
     */
    decay(rate = 0.08) {
        this.state.P += (this.baseline.P - this.state.P) * rate;
        this.state.A += (this.baseline.A - this.state.A) * rate;
        this.state.D += (this.baseline.D - this.state.D) * rate * 0.5; // D衰减更慢

        this._saveState();
    }

    /**
     * 直接设置情绪状态（用于特殊事件）
     */
    setState(newState) {
        if (typeof newState.P === 'number') this.state.P = this._clamp(newState.P);
        if (typeof newState.A === 'number') this.state.A = this._clamp(newState.A);
        if (typeof newState.D === 'number') this.state.D = this._clamp(newState.D);
        this._saveState();
    }

    // ==================== 情绪解读 ====================

    /**
     * 获取当前情绪标签
     */
    getEmotionLabel() {
        const { P, A, D } = this.state;

        // 复合情绪判断（优先级从高到低）
        if (P < -0.6 && A > 0.4) return "愤怒";
        if (P < -0.5 && A > 0.2 && D > 0.3) return "暴躁";
        if (P < -0.4 && A < -0.2) return "抑郁";
        if (P < -0.3 && A > 0.1 && D < -0.2) return "焦虑";
        if (P < -0.2 && A < 0.1) return "低落";
        if (P < 0 && A > 0.3) return "烦躁";

        if (P > 0.6 && A > 0.5) return "狂喜";
        if (P > 0.5 && A > 0.3) return "兴奋";
        if (P > 0.4 && A < 0) return "满足";
        if (P > 0.3 && A > 0.2) return "开心";
        if (P > 0.2 && D < -0.3) return "撒娇";
        if (P > 0.1 && D > 0.3) return "傲娇";

        if (D > 0.4) return "强势";
        if (D < -0.4) return "依赖";
        if (A < -0.3) return "困倦";
        if (A > 0.4) return "亢奋";

        return "平静";
    }

    /**
     * 获取情绪描述（用于Prompt注入）
     */
    getEmotionDescription() {
        const label = this.getEmotionLabel();
        const { P, A, D } = this.state;

        const pDesc = P > 0.3 ? "愉悦" : P < -0.3 ? "不悦" : "平静";
        const aDesc = A > 0.3 ? "活跃" : A < -0.3 ? "低迷" : "稳定";
        const dDesc = D > 0.3 ? "强势" : D < -0.3 ? "顺从" : "中性";

        return {
            label,
            description: `${pDesc}、${aDesc}、${dDesc}`,
            P, A, D
        };
    }

    /**
     * 获取文本风格指导
     */
    getStyleGuide() {
        const { P, A, D } = this.state;

        // P高 + A高 = 兴奋活泼
        if (P > 0.4 && A > 0.4) {
            return {
                style: "excited",
                guide: "使用感叹号和可爱Emoji！语气活泼，句子短促有力！(≧▽≦)/",
                punctuation: "!！~♪",
                emojiFrequency: "high"
            };
        }

        // P高 + A低 = 满足温柔
        if (P > 0.3 && A < 0) {
            return {
                style: "content",
                guide: "语气温柔平和，偶尔使用温馨的颜文字 (◕‿◕)",
                punctuation: "~。",
                emojiFrequency: "medium"
            };
        }

        // P低 + A低 = 抑郁低落
        if (P < -0.3 && A < -0.2) {
            return {
                style: "depressed",
                guide: "回复简短...多用省略号...不使用Emoji...语气低沉",
                punctuation: "...",
                emojiFrequency: "none"
            };
        }

        // P低 + A高 = 愤怒烦躁
        if (P < -0.3 && A > 0.3) {
            return {
                style: "angry",
                guide: "语气冷淡或带刺。可以使用反问句、讽刺。回复可能极短，如只回'。'",
                punctuation: "。？",
                emojiFrequency: "none"
            };
        }

        // D高 = 傲娇模式
        if (D > 0.4) {
            return {
                style: "tsundere",
                guide: "表现得高傲一些，话语中带着不屑但又有点在意。'哼，才不是因为担心你呢！'",
                punctuation: "！哼",
                emojiFrequency: "low"
            };
        }

        // D低 = 黏人模式
        if (D < -0.4) {
            return {
                style: "clingy",
                guide: "表现得依赖和黏人，撒娇语气，'人家想你了嘛~' (◕ᴗ◕✿)",
                punctuation: "~嘛呢",
                emojiFrequency: "high"
            };
        }

        return {
            style: "neutral",
            guide: "正常语气，适度使用颜文字",
            punctuation: "。~",
            emojiFrequency: "medium"
        };
    }

    /**
     * 检查是否应该触发Ghosting（已读不回）
     */
    shouldGhost() {
        return this.state.P < -0.75;
    }

    /**
     * 生成Prompt注入文本
     */
    getPromptInjection() {
        const emotion = this.getEmotionDescription();
        const style = this.getStyleGuide();

        return `[Emotional State - 当前情绪]
- 情绪: ${emotion.label}
- P(愉悦): ${emotion.P.toFixed(2)} | A(激活): ${emotion.A.toFixed(2)} | D(优势): ${emotion.D.toFixed(2)}
- 状态描述: ${emotion.description}

[Response Style - 回复风格]
${style.guide}
- 标点倾向: ${style.punctuation}
- Emoji使用: ${style.emojiFrequency === 'high' ? '频繁使用' : style.emojiFrequency === 'none' ? '禁止使用' : '适度使用'}`;
    }

    // ==================== 辅助方法 ====================

    /**
     * 根据用户输入分析情绪影响
     */
    analyzeInput(userInput, affinity) {
        const delta = { P: 0, A: 0, D: 0 };

        // 正面词汇
        const positiveWords = ['爱', '喜欢', '开心', '谢谢', '好棒', '厉害', '可爱', '漂亮', '想你', '抱抱'];
        const negativeWords = ['讨厌', '滚', '烦', '傻', '笨', '丑', '恶心', '闭嘴', '走开'];
        const excitingWords = ['惊喜', '太棒了', '哇', '好激动', '天啊'];
        const calmingWords = ['晚安', '休息', '慢慢', '别急', '放松'];

        const input = userInput.toLowerCase();

        // 分析P值变化
        positiveWords.forEach(w => { if (input.includes(w)) delta.P += 0.15; });
        negativeWords.forEach(w => { if (input.includes(w)) delta.P -= 0.25; });

        // 分析A值变化
        excitingWords.forEach(w => { if (input.includes(w)) delta.A += 0.2; });
        calmingWords.forEach(w => { if (input.includes(w)) delta.A -= 0.15; });
        if (input.includes('!') || input.includes('！')) delta.A += 0.1;

        // 好感度影响解读
        if (affinity < 30) {
            // 低好感度时，亲密词汇反而让AI不适
            if (positiveWords.some(w => ['爱', '喜欢', '想你', '抱抱'].includes(w) && input.includes(w))) {
                delta.P -= 0.1;
                delta.A += 0.15; // 紧张
                delta.D -= 0.1; // 感到被压迫
            }
        }

        // 限制单次变化幅度
        delta.P = Math.max(-0.5, Math.min(0.5, delta.P));
        delta.A = Math.max(-0.4, Math.min(0.4, delta.A));
        delta.D = Math.max(-0.3, Math.min(0.3, delta.D));

        return delta;
    }

    /**
     * 获取当前状态快照（用于记忆存储）
     */
    getSnapshot() {
        return { ...this.state, timestamp: Date.now() };
    }

    /**
     * 获取完整状态
     */
    getFullState() {
        return {
            current: { ...this.state },
            baseline: { ...this.baseline },
            label: this.getEmotionLabel(),
            style: this.getStyleGuide(),
            shouldGhost: this.shouldGhost()
        };
    }

    // ==================== 持久化 ====================

    _loadState() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));
                if (data.state) this.state = data.state;
                if (data.baseline) this.baseline = data.baseline;
                if (data.history) this.history = data.history.slice(-this.maxHistory);
                console.log(`[Emotion] Loaded state: ${this.getEmotionLabel()}`);
            }
        } catch (e) {
            console.error('[Emotion] Load error:', e.message);
        }
    }

    _saveState() {
        try {
            const dir = path.dirname(this.statePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.statePath, JSON.stringify({
                state: this.state,
                baseline: this.baseline,
                history: this.history,
                lastUpdated: new Date().toISOString()
            }, null, 2));
        } catch (e) {
            console.error('[Emotion] Save error:', e.message);
        }
    }

    _clamp(v) {
        return Math.max(-1, Math.min(1, v));
    }
}

export default EmotionEngine;
