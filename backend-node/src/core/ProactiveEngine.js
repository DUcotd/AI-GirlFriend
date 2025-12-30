import TaskManager from './TaskManager.js';
import LifeSimulator from './LifeSimulator.js';
/**
 * 主动消息引擎 - 智能触发AI女友的主动消息
 * 
 * 功能特点：
 * - 多种触发类型：早晚问候、任务提醒、想念消息、情绪关怀等
 * - 消息队列：支持多条待发送消息，避免覆盖
 * - 智能冷却：根据好感度和用户活跃度调整触发频率
 * - 用户活跃追踪：优化触发时机
 */
class ProactiveEngine {
    constructor(aiGirlfriend) {
        this.aiGirlfriend = aiGirlfriend;

        // 用户可配置选项
        this.config = {
            enabled: true,                    // 是否启用主动消息
            frequencyLevel: 'medium',         // 频率级别: low, medium, high
            customDailyLimit: null,           // 用户自定义每日上限（null 表示使用默认）
            enabledTypes: [                   // 启用的消息类型
                'morning_greeting',
                'night_greeting',
                'task_reminder',
                'random_chat',
                'miss_you',
                'mood_check',
                'memory_share',
                'life_update'             // 新增：生活更新消息
            ]
        };

        // 频率级别对应的倍率
        this.frequencyMultipliers = {
            low: { cooldown: 2.0, dailyLimit: 0.5 },
            medium: { cooldown: 1.0, dailyLimit: 1.0 },
            high: { cooldown: 0.7, dailyLimit: 1.5 }
        };

        // 消息队列（支持多条待发送消息）
        this.messageQueue = [];
        this.maxQueueSize = 5;

        // 时间追踪
        this.lastTriggerTime = Date.now();
        this.lastUserActiveTime = Date.now();
        this.checkInterval = 60000; // 每分钟检查一次

        // 各触发类型的基础冷却时间（毫秒）
        this.baseTriggerCooldowns = {
            morning_greeting: 24 * 60 * 60 * 1000,    // 24小时
            night_greeting: 24 * 60 * 60 * 1000,      // 24小时
            task_reminder: 30 * 60 * 1000,             // 30分钟
            random_chat: 2 * 60 * 60 * 1000,          // 2小时
            miss_you: 3 * 60 * 60 * 1000,             // 3小时
            mood_check: 4 * 60 * 60 * 1000,           // 4小时
            memory_share: 6 * 60 * 60 * 1000,         // 6小时
            life_update: 30 * 60 * 1000,              // 30分钟 - 生活更新冷却
        };

        // 各类型的上次触发时间
        this.lastTriggerByType = {};

        this.dailyMessageCount = 0;
        this.lastDayReset = new Date().toDateString();

        // 生活模拟器
        this.lifeSimulator = new LifeSimulator();

        this.start();
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        if (typeof newConfig.enabled === 'boolean') {
            this.config.enabled = newConfig.enabled;
        }
        if (newConfig.frequencyLevel && ['low', 'medium', 'high'].includes(newConfig.frequencyLevel)) {
            this.config.frequencyLevel = newConfig.frequencyLevel;
        }
        if (typeof newConfig.customDailyLimit === 'number' && newConfig.customDailyLimit >= 0) {
            this.config.customDailyLimit = newConfig.customDailyLimit;
        } else if (newConfig.customDailyLimit === null) {
            this.config.customDailyLimit = null;
        }
        if (Array.isArray(newConfig.enabledTypes)) {
            this.config.enabledTypes = newConfig.enabledTypes.filter(t =>
                Object.keys(this.baseTriggerCooldowns).includes(t)
            );
        }
        console.log("[ProactiveEngine] Config updated:", this.config);
        return this.config;
    }

    /**
     * 获取当前配置
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * 获取基于频率级别调整后的冷却时间
     */
    get triggerCooldowns() {
        const multiplier = this.frequencyMultipliers[this.config.frequencyLevel]?.cooldown || 1.0;
        const adjusted = {};
        for (const [type, baseCooldown] of Object.entries(this.baseTriggerCooldowns)) {
            // 早晚问候固定24小时，不调整
            if (type === 'morning_greeting' || type === 'night_greeting') {
                adjusted[type] = baseCooldown;
            } else {
                adjusted[type] = Math.round(baseCooldown * multiplier);
            }
        }
        return adjusted;
    }

    start() {
        if (this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => this.check(), this.checkInterval);
        console.log("[ProactiveEngine] Started with enhanced triggers");
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
            console.log("[ProactiveEngine] Stopped");
        }
    }

    /**
     * 通知用户活跃（由外部调用）
     */
    notifyUserActive() {
        const inactiveTime = Date.now() - this.lastUserActiveTime;
        const wasInactive = inactiveTime > 30 * 60 * 1000; // 30分钟算不活跃
        const inactiveMinutes = Math.floor(inactiveTime / (1000 * 60));

        this.lastUserActiveTime = Date.now();

        // 如果用户长时间不活跃后回来，触发生活更新消息
        if (wasInactive && this.canTrigger('life_update')) {
            const lifeSummary = this.lifeSimulator.getWelcomeBackSummary(inactiveMinutes);
            this.trigger('life_update', {
                inactiveMinutes,
                activities: lifeSummary.activities,
                currentActivity: lifeSummary.currentActivity
            });
        }
    }

    /**
     * 检查是否可以触发某类型消息
     */
    canTrigger(type) {
        // 检查该类型是否启用
        if (!this.config.enabledTypes.includes(type)) {
            return false;
        }
        const cooldown = this.triggerCooldowns[type] || 60 * 60 * 1000;
        const lastTrigger = this.lastTriggerByType[type] || 0;
        return (Date.now() - lastTrigger) >= cooldown;
    }

    /**
     * 获取基于好感度的触发概率加成
     */
    getAffinityBonus() {
        const affinity = this.aiGirlfriend.affinity || 35;
        // 好感度越高，触发概率越大
        // 0-20: 0.5倍, 21-40: 0.8倍, 41-60: 1倍, 61-80: 1.3倍, 81-100: 1.6倍
        if (affinity <= 20) return 0.5;
        if (affinity <= 40) return 0.8;
        if (affinity <= 60) return 1.0;
        if (affinity <= 80) return 1.3;
        return 1.6;
    }

    /**
     * 获取今日可发送消息上限
     */
    getDailyLimit() {
        // 如果用户设置了自定义上限，使用自定义值
        if (this.config.customDailyLimit !== null) {
            return this.config.customDailyLimit;
        }

        // 否则根据好感度计算基础上限
        const affinity = this.aiGirlfriend.affinity || 35;
        let baseLimit;
        if (affinity <= 20) baseLimit = 3;
        else if (affinity <= 40) baseLimit = 5;
        else if (affinity <= 60) baseLimit = 8;
        else if (affinity <= 80) baseLimit = 12;
        else baseLimit = 15;

        // 应用频率级别倍率
        const multiplier = this.frequencyMultipliers[this.config.frequencyLevel]?.dailyLimit || 1.0;
        return Math.round(baseLimit * multiplier);
    }

    /**
     * 重置每日计数
     */
    resetDailyCountIfNeeded() {
        const today = new Date().toDateString();
        if (today !== this.lastDayReset) {
            this.dailyMessageCount = 0;
            this.lastDayReset = today;
        }
    }

    async check() {
        // 检查是否启用主动消息
        if (!this.config.enabled) {
            return;
        }

        this.resetDailyCountIfNeeded();

        // 检查每日限额
        if (this.dailyMessageCount >= this.getDailyLimit()) {
            return;
        }

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        // 1. 确定性触发：早晚问候
        if (minute >= 0 && minute <= 5) {
            if (hour === 8 && this.canTrigger('morning_greeting')) {
                return this.trigger("morning_greeting");
            }
            if (hour === 22 && this.canTrigger('night_greeting')) {
                return this.trigger("night_greeting");
            }
        }

        // 2. 任务触发：截止前 15 分钟
        if (this.canTrigger('task_reminder')) {
            const dueSoon = TaskManager.getDueSoonTasks(15);
            if (dueSoon.length > 0) {
                return this.trigger("task_reminder", { task: dueSoon[0] });
            }
        }

        // 3. 情绪关怀：下午或晚间询问用户状态
        if ((hour === 15 || hour === 20) && minute >= 0 && minute <= 5) {
            if (this.canTrigger('mood_check')) {
                return this.trigger("mood_check");
            }
        }

        // 4. 想念消息：用户长时间未活跃
        const inactiveTime = Date.now() - this.lastUserActiveTime;
        if (inactiveTime > 2 * 60 * 60 * 1000 && this.canTrigger('miss_you')) { // 2小时未活跃
            const probability = 0.3 * this.getAffinityBonus();
            if (Math.random() < probability) {
                return this.trigger("miss_you", {
                    inactiveMinutes: Math.floor(inactiveTime / (1000 * 60))
                });
            }
        }

        // 5. 记忆分享：高好感度时偶尔分享回忆
        if (this.aiGirlfriend.affinity >= 50 && this.canTrigger('memory_share')) {
            const probability = 0.15 * this.getAffinityBonus();
            if (Math.random() < probability) {
                return this.trigger("memory_share");
            }
        }

        // 6. 随机闲聊（原有逻辑优化）
        if (minute === 0 || minute === 30) {
            const timeSinceLast = (Date.now() - this.lastTriggerTime) / (1000 * 60 * 60);
            if (timeSinceLast >= 1 && this.canTrigger('random_chat')) {
                // 优化概率计算：考虑好感度加成
                const baseP = (this.aiGirlfriend.affinity / 200) + (timeSinceLast / 24);
                const p = baseP * this.getAffinityBonus();
                if (Math.random() < Math.min(p, 0.4)) { // 概率上限40%
                    return this.trigger("random_chat");
                }
            }
        }
    }

    async trigger(reason, data = {}) {
        // 检查队列是否已满
        if (this.messageQueue.length >= this.maxQueueSize) {
            console.log(`[ProactiveEngine] Queue full, skipping: ${reason}`);
            return;
        }

        console.log(`[ProactiveEngine] Triggering: ${reason}`);

        try {
            const message = await this.aiGirlfriend.generateProactiveMessage(reason, data);
            if (message) {
                this.messageQueue.push({
                    id: Date.now().toString(),
                    content: message.reply,
                    emotion: message.emotion,
                    timestamp: new Date().toISOString(),
                    reason,
                    priority: this.getMessagePriority(reason)
                });

                // 按优先级排序（高优先级在前）
                this.messageQueue.sort((a, b) => b.priority - a.priority);

                this.lastTriggerTime = Date.now();
                this.lastTriggerByType[reason] = Date.now();
                this.dailyMessageCount++;

                console.log(`[ProactiveEngine] Message queued. Queue size: ${this.messageQueue.length}`);
            }
        } catch (e) {
            console.error("[ProactiveEngine] Trigger failed:", e);
        }
    }

    /**
     * 获取消息优先级
     */
    getMessagePriority(reason) {
        const priorities = {
            task_reminder: 100,      // 任务提醒最重要
            morning_greeting: 80,
            night_greeting: 80,
            mood_check: 60,
            miss_you: 50,
            memory_share: 40,
            random_chat: 30
        };
        return priorities[reason] || 20;
    }

    /**
     * 消费一条消息（供API调用）
     */
    consumeMessage() {
        if (this.messageQueue.length === 0) {
            return null;
        }
        return this.messageQueue.shift();
    }

    /**
     * 查看队列状态（不消费）
     */
    peekQueue() {
        return {
            size: this.messageQueue.length,
            messages: this.messageQueue.map(m => ({
                id: m.id,
                reason: m.reason,
                timestamp: m.timestamp
            }))
        };
    }

    /**
     * 获取引擎状态
     */
    getStatus() {
        return {
            config: this.getConfig(),
            queueSize: this.messageQueue.length,
            dailyMessagesSent: this.dailyMessageCount,
            dailyLimit: this.getDailyLimit(),
            lastTriggerTime: this.lastTriggerTime,
            lastUserActiveTime: this.lastUserActiveTime,
            affinityBonus: this.getAffinityBonus(),
            currentCooldowns: this.triggerCooldowns
        };
    }
}

export default ProactiveEngine;
