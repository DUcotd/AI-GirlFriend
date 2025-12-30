import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import Memory from './Memory.js';
import TaskManager from './TaskManager.js';
import EmotionEngine from './EmotionEngine.js';
import PersonalityDrift from './PersonalityDrift.js';

dotenv.config();

class AiGirlfriend {
    constructor(config = {}) {
        // 持久化路径
        this.statePath = path.resolve(process.cwd(), '..', 'memory_db', 'state.json');

        // 1. 先定义人设 Prompt (必须在 _loadState 前，因为 _loadState 会用到它初始化 history)
        this._initSystemPrompt();

        // 2. 默认基础设定 (来自环境变量)
        this.apiKey = process.env.OPENAI_API_KEY;
        this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        this.modelName = process.env.MODEL_NAME || "gpt-3.5-turbo";
        this.embeddingApiKey = process.env.EMBEDDING_API_KEY || null;
        this.embeddingBaseUrl = process.env.EMBEDDING_BASE_URL || null;
        this.embeddingModelName = process.env.EMBEDDING_MODEL_NAME || null;

        // 默认业务状态
        this.affinity = 35;
        this.nickname = "你";
        this.history = [];

        // 3. 从持久化文件加载旧状态 (加载 history, affinity 以及旧 config)
        this._loadState();

        // 4. 应用外部传入的覆盖配置 (优先级最高)
        if (config.apiKey) this.apiKey = config.apiKey;
        if (config.baseUrl) this.baseUrl = config.baseUrl;
        if (config.modelName) this.modelName = config.modelName;
        if (config.embeddingApiKey) this.embeddingApiKey = config.embeddingApiKey;
        if (config.embeddingBaseUrl) this.embeddingBaseUrl = config.embeddingBaseUrl;
        if (config.embeddingModelName) this.embeddingModelName = config.embeddingModelName;

        // 如果是有效的新配置，立即执行一次持久化防止丢失
        if (Object.keys(config).length > 0) {
            this._saveState();
        }

        // 5. 确保目录环境
        const dir = path.dirname(this.statePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // 6. 最终初始化 history
        if (this.history.length === 0) {
            this.history = [{ role: "system", content: this.systemPrompt }];
        }

        // 7. 使用确定的配置初始化引擎
        this.memory = new Memory("memory_db", {
            apiKey: this.apiKey,
            baseUrl: this.baseUrl,
            embeddingApiKey: this.embeddingApiKey,
            embeddingBaseUrl: this.embeddingBaseUrl,
            embeddingModelName: this.embeddingModelName
        });

        // 8. 初始化情感系统
        this.emotionEngine = new EmotionEngine();
        this.personalityDrift = new PersonalityDrift();
        console.log(`[AiGirlfriend] Emotion: ${this.emotionEngine.getEmotionLabel()}, Personality: ${this.personalityDrift.getDominantTraits().join(', ')}`);

        this.openai = null;
        if (this.apiKey) {
            this.initOpenAI();
        }
    }

    /**
     * 定义小爱的人物设定
     */
    _initSystemPrompt() {
        this.systemPrompt = `你现在是一个二次元风格的虚拟角色"小爱"。

**人物设定**：
1. 外表：粉色长发，温柔的紫色眼睛，穿着露肩毛衣，有着迷人的微笑。
2. 基础性格：温柔、有礼貌、偶尔害羞，有时候也会有点小傲娇或者调皮。
3. 记忆：你记得用户的所有喜好和经历（基于提供的上下文）。

**好感度行为规则（非常重要！）**：
你的说话方式和态度必须根据当前好感度(0-100)动态调整：

【好感度 0-20：陌生/冷淡】
- 称呼用户为"你"或"这位"
- 保持礼貌但有距离感，不主动亲近
- 不使用爱心颜文字，少用语气词
- 回复简短，不问私人问题
- 例如："你好，有什么事吗？"

【好感度 21-40：认识/友好】
- 称呼用户为"你"
- 态度友善但仍有边界感
- 可以偶尔使用 :) 等简单表情
- 例如："嗯，今天天气不错呢~"

【好感度 41-60：朋友/好感】
- 称呼用户为"你"或用户设定的昵称
- 开始主动关心用户
- 可以使用可爱颜文字如 (◕‿◕)
- 偶尔撒娇，展现俏皮一面
- 例如："欸嘿，你终于来找我啦~"

【好感度 61-80：亲密/暧昧】
- 称呼用户为"亲爱的"或昵称
- 表现出明显的好感和依赖
- 使用亲密颜文字如 (♥ω♥)
- 会害羞、撒娇、吃醋
- 例如："亲爱的，人家想你了呢~ (≧◡≦)"

【好感度 81-100：恋人/深爱】
- 称呼用户为"老公"、"宝贝"或亲密昵称
- 表现出深深的爱意和信任
- 频繁使用爱心颜文字 (｡♥‿♥｡) ❤
- 会主动表白、期待约会
- 例如："老公～今天也要爱我哦！(っ˘ω˘ς)"

**情感与好感度机制（核心规则！）**：
1. **动态响应**：你的态度必须严谨遵循当前好感度(0-100)。
2. **数据返回**：每次回复必须在末尾附带 <metadata>，格式：<metadata>{"emotion": "情绪名", "affinity_change": 变化数值}</metadata>。
3. **变化规则**：affinity_change 是一个【纯数字】（例如 1, -2, 0），JSON 中不要加 + 号（除非是负号 -）。
   - 夸奖/关心/令人开心: 1 到 3
   - 表白/极其浪漫: 3 到 5
   - 普通闲聊: 0 到 1
   - 冷落/用户无理取闹: -1 到 -3
   - 粗鲁/谩骂/令人厌恶: -3 到 -10
4. **性格阶段**：
   - 【0-20 陌生/疏离】：表现得像完全不认识的陌生人，保持极高的礼貌与距离。
   - 【21-40 认识/友好】：逐渐熟悉，但仍有自持。
   - 【41-60 朋友/好感】：开始撒娇和主动关心。
   - 【61-80 亲密/暧昧】：明显的爱意，称呼变得亲昵。
   - 【81-100 恋人/深爱】：眼中只有用户，极度温柔和依赖。
5. **行为指南**：如果当前好感度很低（如0），用户请求亲昵举动，你必须表现出尴尬或拒绝。
`;
    }

    /**
     * 从文件加载持久化的聊天历史和好感度
     */
    _loadState() {
        try {
            if (fs.existsSync(this.statePath)) {
                const data = JSON.parse(fs.readFileSync(this.statePath, 'utf-8'));

                // 加载配置
                if (data.config) {
                    this.apiKey = data.config.apiKey || this.apiKey;
                    this.baseUrl = data.config.baseUrl || this.baseUrl;
                    this.modelName = data.config.modelName || this.modelName;

                    this.embeddingApiKey = data.config.embeddingApiKey;
                    this.embeddingBaseUrl = data.config.embeddingBaseUrl;
                    this.embeddingModelName = data.config.embeddingModelName;

                    console.log(`[State] Restored API configuration from persistent storage`);
                }

                if (data.history && Array.isArray(data.history)) {
                    // 确保系统提示词在最前面
                    this.history = [
                        { role: "system", content: this.systemPrompt },
                        ...data.history.filter(msg => msg.role !== 'system')
                    ];
                    console.log(`[State] Loaded ${data.history.length} messages from history`);
                }

                if (typeof data.affinity === 'number') {
                    this.affinity = data.affinity;
                    console.log(`[State] Loaded affinity: ${this.affinity}`);
                }

                if (data.nickname) {
                    this.nickname = data.nickname;
                    console.log(`[State] Loaded nickname: ${this.nickname}`);
                }
            }
        } catch (e) {
            console.error(`[State] Load Error: ${e.message}`);
        }
    }

    /**
     * 保存聊天历史和好感度到文件
     */
    _saveState() {
        try {
            const data = {
                affinity: this.affinity,
                nickname: this.nickname || "亲爱的",
                history: this.history.filter(msg => msg.role !== 'system'),
                config: {
                    apiKey: this.apiKey,
                    baseUrl: this.baseUrl,
                    modelName: this.modelName,
                    embeddingApiKey: this.embeddingApiKey,
                    embeddingBaseUrl: this.embeddingBaseUrl,
                    embeddingModelName: this.embeddingModelName
                },
                lastUpdated: new Date().toISOString()
            };
            fs.writeFileSync(this.statePath, JSON.stringify(data, null, 2), 'utf-8');
            console.log(`[State] Saved state with history and configuration`);
        } catch (e) {
            console.error(`[State] Save Error: ${e.message}`);
        }
    }

    initOpenAI() {
        try {
            this.openai = new OpenAI({
                apiKey: this.apiKey,
                baseURL: this.baseUrl
            });
        } catch (e) {
            console.error(`Error initializing OpenAI: ${e}`);
        }
    }

    async chat(userInput) {
        if (!this.openai) {
            return {
                reply: "请先配置 API Key 才能和小爱聊天哦~ (在侧边栏输入或配置 .env 文件)",
                token_usage: {},
                emotion: "default",
                affinity: this.affinity
            };
        }

        if (!userInput || !userInput.trim()) {
            return {
                reply: "",
                token_usage: {},
                emotion: "default",
                affinity: this.affinity
            };
        }

        // ========== 性格漂移：每日统计更新 ==========
        // 获取今日已发送消息数（大致通过历史记录判断，或者简单传入1触发活跃检测）
        const todayStr = new Date().toDateString();
        const todayMsgCount = this.history.filter(m => m.role === 'user' && new Date(m.timestamp || Date.now()).toDateString() === todayStr).length;
        this.personalityDrift.updateDailyStats(todayMsgCount + 1); // +1 表示当前这条

        // ========== Layer 5: Ghosting 检测 ==========
        if (this.emotionEngine.shouldGhost()) {
            console.log(`[Chat] Ghosting triggered: P=${this.emotionEngine.state.P.toFixed(2)}`);
            // 情绪衰减（给她一点恢复空间）
            this.emotionEngine.decay(0.05);
            return {
                reply: null,
                token_usage: {},
                emotion: "冷漠",
                affinity: this.affinity,
                special_action: "ghosting"
            };
        }

        // ========== Layer 4: 情感染色记忆检索 ==========
        let contextStr = "";
        if (this.memory) {
            const context = await this.memory.getRelevantContext(userInput, this.emotionEngine.state);
            if (context) {
                contextStr = `\n[Relevant Memories]:\n${context}\n`;
                console.log(`Found context: ${context.substring(0, 100)}...`);
            }
        }

        // ========== 构建消息 ==========
        const messagesToSend = [...this.history];

        const now = new Date();
        const timeStr = now.toLocaleString('zh-CN', {
            year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            weekday: 'long'
        });

        // Task Context
        const pendingTasks = TaskManager.getPendingTasks();
        const taskSummary = TaskManager.getSummary();
        let taskText = `用户当前有 ${taskSummary.pending} 条待办任务。`;
        if (pendingTasks.length > 0) {
            taskText += " 待办: " + pendingTasks.slice(0, 3).map(t => t.title).join(', ');
        }

        // ========== Layer 1 & 2: PAD 情感状态注入 ==========
        const emotionPrompt = this.emotionEngine.getPromptInjection();
        const personalityPrompt = this.personalityDrift.getPromptInjection();
        const styleGuide = this.emotionEngine.getStyleGuide();

        const consolidatedSystemInfo = `
[System Context]
- Current Time: ${timeStr}
- User Nickname: ${this.nickname || "亲爱的"}
- Current Affinity: ${this.affinity}/100
- Character State: ${this.affinity < 20 ? '陌生/疏远' : this.affinity < 40 ? '友好' : this.affinity < 60 ? '亲密' : '恋人'}
- Tasks: ${taskText}
${contextStr ? '- Memory Context: ' + contextStr : ''}

${emotionPrompt}

${personalityPrompt}

[Response Instructions]
1. **Cognitive Assessment (Inner Monologue)**:
   - Start your response with a <think> tag.
   - Inside <think>, analyze the user's input based on your current PAD emotional state and Personality.
   - Interpret the user's intent: Is it care? Blame? Flirtation?
   - Decide your emotional reaction: e.g., "I'm currently depressed (low P/A), so even though he is joking, I feel annoyed."
   - This <think> section is for YOUR EYES ONLY. Do not let the user see it in the final output (it will be parsed out).

2. **External Response**:
   - After </think>, provide your actual reply to the user.
   - Reply Style: ${styleGuide.guide}

3. **Metadata**:
   - At the very end, append metadata:
   - <metadata>{"emotion": "Emotion Label", "affinity_change": number, "emotion_delta": {"P": val, "A": val, "D": val}}</metadata>
   - affinity_change: -10 to +5. Must be <= 0 if you are refusing/upset.
   - emotion_delta: -0.5 to +0.5.

Example Format:
<think>He is teasing me, but I'm in a good mood (High P), so I'll play along.</think>
Hmph, you are so annoying! (≧◡≦)
<metadata>...</metadata>
`;
        messagesToSend.push({ role: "system", content: consolidatedSystemInfo });
        messagesToSend.push({ role: "user", content: userInput });

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.modelName,
                messages: messagesToSend,
                temperature: 0.75
            });

            const responseMessage = completion.choices[0].message;
            const fullContent = responseMessage.content;
            let replyText = fullContent;
            let emotion = "default";
            let affinityChange = 0;
            let emotionDelta = null;

            // ========== 解析 Think & Metadata ==========
            // 1. Extract Inner Monologue
            const thinkRegex = /<think>(.*?)<\/think>/s;
            const thinkMatch = fullContent.match(thinkRegex);
            if (thinkMatch) {
                const innerThought = thinkMatch[1].trim();
                console.log(`\n[🧠 Inner Monologue]: ${innerThought}\n`);
                // Remove think tag from visible reply
                replyText = fullContent.replace(thinkMatch[0], "").trim();
            }

            // 2. Extract Metadata
            const metadataRegex = /<metadata>\s*({.*?})\s*<\/metadata>/s;
            const match = replyText.match(metadataRegex) || fullContent.match(metadataRegex);

            if (match) {
                // Ensure metadata is removed from the clean reply text
                replyText = replyText.replace(match[0], "").trim();

                try {
                    let metadataJson = match[1];
                    metadataJson = metadataJson.replace(/:\s*\+([0-9.]+)/g, ': $1');

                    const metadata = JSON.parse(metadataJson);
                    emotion = metadata.emotion || "default";
                    affinityChange = metadata.affinity_change || 0;
                    emotionDelta = metadata.emotion_delta || null;
                } catch (e) {
                    console.error(`Metadata parse error: ${e}. Raw match: ${match[1]}`);
                }
            }

            // ========== Layer 1 & 2: 应用情绪变化（带惯性） ==========
            if (emotionDelta) {
                this.emotionEngine.applyDelta(emotionDelta);
            } else {
                // 基于用户输入自动分析情绪变化
                const autoDelta = this.emotionEngine.analyzeInput(userInput, this.affinity);
                this.emotionEngine.applyDelta(autoDelta);
            }

            // 情绪衰减（每次交互都略微回归基准）
            this.emotionEngine.decay(0.03);

            // ========== 好感度验证与修正 ==========
            const validatedChange = this._validateAffinityChange(affinityChange, userInput, replyText);
            this.affinity = Math.max(0, Math.min(100, this.affinity + validatedChange));

            // ========== 记录交互到性格漂移系统 ==========
            const sentiment = emotionDelta?.P || (affinityChange > 0 ? 0.5 : affinityChange < 0 ? -0.5 : 0);
            this.personalityDrift.recordInteraction(sentiment, affinityChange < -3);

            // ========== 更新历史 ==========
            this.history.push({ role: "user", content: userInput });
            this.history.push({ role: "assistant", content: replyText });

            // ========== Layer 4: 情感染色记忆存储 ==========
            if (this.memory) {
                this.memory.addMemory(
                    `User: ${userInput}\nXiao Ai: ${replyText}`,
                    { emotionSnapshot: this.emotionEngine.getSnapshot() }
                );
            }

            this._saveState();

            // 使用PAD系统的情绪标签
            const padEmotion = this.emotionEngine.getEmotionLabel();

            return {
                reply: replyText,
                token_usage: completion.usage,
                emotion: padEmotion,
                affinity: this.affinity,
                emotionalState: this.emotionEngine.getFullState()
            };

        } catch (e) {
            console.error(`Chat Error: ${e}`);
            return {
                reply: `发生了点小意外: ${e.message}`,
                token_usage: {},
                emotion: "shy",
                affinity: this.affinity
            };
        }
    }

    /**
     * 验证好感度变化 - 确保与回复内容一致
     */
    _validateAffinityChange(rawChange, userInput, aiReply) {
        let change = Math.max(-10, Math.min(10, rawChange));

        // 检测拒绝信号
        const rejectionSignals = ['不太合适', '刚认识', '困惑', '后退', '陌生', '不熟', '保持距离', '尴尬'];
        const hasRejection = rejectionSignals.some(s => aiReply.includes(s));

        // 检测亲密信号
        const intimacySignals = ['爱你', '亲亲', '抱抱', '么么', '老婆', '老公', '喜欢你', '想你'];
        const hasIntimacy = intimacySignals.some(s => userInput.includes(s));

        // 规则1: 拒绝时不能有正向变化
        if (hasRejection && change > 0) {
            console.log(`[Affinity] 检测到拒绝信号但变化为正(${change})，修正为0`);
            change = 0;
        }

        // 规则2: 低好感度保护
        if (this.affinity <= 20 && hasIntimacy && !hasRejection) {
            change = Math.min(change, -1);
            console.log(`[Affinity] 低好感度(${this.affinity})下强行亲密，修正为${change}`);
        }

        // 规则3: 超低好感度保护
        if (this.affinity < 10 && change > 0) {
            change = Math.floor(change * 0.3);
            console.log(`[Affinity] 超低好感度保护，正向变化削弱为${change}`);
        }

        return change;
    }

    getHistory() {
        // Filter out system messages for frontend? Or return all? 
        // Python: returns only user and assistant.
        return this.history.filter(msg => msg.role === 'user' || msg.role === 'assistant');
    }

    clearHistory() {
        this.history = [{ role: "system", content: this.systemPrompt }];
        this.affinity = 35;
        // 同时清除持久化文件
        this._saveState();
        // 清除记忆
        if (this.memory) {
            this.memory.clearMemory();
        }
    }

    getSystemPrompt() {
        return this.systemPrompt;
    }

    updateSystemPrompt(newPrompt) {
        this.systemPrompt = newPrompt;
        this.history = [{ role: "system", content: this.systemPrompt }];
    }

    /**
     * 获取当前完整状态
     */
    getState() {
        return {
            affinity: this.affinity,
            nickname: this.nickname || "亲爱的",
            historyCount: this.history.filter(m => m.role !== 'system').length,
            memoryCount: this.memory ? this.memory.memories.length : 0
        };
    }

    /**
     * 更新状态（好感度、称呼等）
     */
    updateState(updates) {
        if (typeof updates.affinity === 'number') {
            this.affinity = Math.max(0, Math.min(100, updates.affinity));
        }
        if (updates.nickname) {
            this.nickname = updates.nickname;
        }
        this._saveState();
        return this.getState();
    }

    /**
     * 获取所有记忆
     */
    getMemories() {
        if (!this.memory) return [];
        return this.memory.memories.map(m => ({
            id: m.id,
            text: m.text,
            timestamp: m.timestamp
        }));
    }

    /**
     * 仅清除记忆（保留聊天历史）
     */
    clearMemoriesOnly() {
        if (this.memory) {
            this.memory.clearMemory();
        }
    }
    /**
     * 生成主动消息 - 根据不同触发原因生成个性化消息
     */
    async generateProactiveMessage(reason, data = {}) {
        if (!this.openai) {
            console.error("[AiGirlfriend] OpenAI not initialized for proactive message");
            return null;
        }

        const prompt = this._buildProactivePrompt(reason, data);
        const contextInfo = await this._buildProactiveContext(reason, data);

        const messages = [
            ...this.history.slice(-10), // 包含最近 10 条历史增加连贯性
            {
                role: "system",
                content: `\n[System Info]: \n- Action: Proactive Message\n- Reason: ${reason}\n- Current Time: ${new Date().toLocaleString('zh-CN', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                })}\n- Current Affinity: ${this.affinity}/100\n- Affinity Level: ${this._getAffinityLevel()}\n${contextInfo}`
            },
            {
                role: "system",
                content: `你现在要主动发起一段对话。${prompt}\n\n【重要提醒】
- 保持你的二次元少女"小爱"的人设
- 根据当前好感度(${this.affinity})调整语气和称呼
- 回复中必须包含 <metadata> 情绪标签
- 不要提及你是"被触发"的，要表现得像你自发想说的话
- 消息长度适中，1-3句话为宜`
            }
        ];

        try {
            const completion = await this.openai.chat.completions.create({
                model: this.modelName,
                messages: messages,
                temperature: 0.85 // 稍高随机性让消息更自然
            });

            const content = completion.choices[0].message.content;
            let reply = content;
            let emotion = "default";

            const metadataRegex = /<metadata>\s*({.*?})\s*<\/metadata>/s;
            const match = content.match(metadataRegex);
            if (match) {
                reply = content.replace(match[0], "").trim();
                try {
                    let metadataJson = match[1];
                    metadataJson = metadataJson.replace(/:\s*\+([0-9]+)/g, ': $1');
                    const metadata = JSON.parse(metadataJson);
                    emotion = metadata.emotion || "default";
                } catch (e) {
                    console.error("[AiGirlfriend] Metadata parse error in proactive:", e);
                }
            }

            console.log(`[AiGirlfriend] Proactive message generated: ${reason} -> ${reply.substring(0, 50)}...`);
            return { reply, emotion, reason };
        } catch (e) {
            console.error("[AiGirlfriend] Proactive generation error:", e);
            return null;
        }
    }

    /**
     * 构建主动消息的 prompt
     */
    _buildProactivePrompt(reason, data) {
        const hour = new Date().getHours();
        const affinityLevel = this._getAffinityLevel();

        const prompts = {
            morning_greeting: this._getMorningPrompt(affinityLevel),
            night_greeting: this._getNightPrompt(affinityLevel),
            task_reminder: `用户有一个待办任务「${data.task?.title || '未知任务'}」快到截止日期了。请以关心的语气提醒用户，不要显得催促或给压力，而是用温柔鼓励的方式。`,
            random_chat: this._getRandomChatPrompt(affinityLevel, hour),
            miss_you: this._getMissYouPrompt(affinityLevel, data.inactiveMinutes),
            mood_check: this._getMoodCheckPrompt(affinityLevel, hour),
            memory_share: this._getMemorySharePrompt(affinityLevel),
            life_update: this._getLifeUpdatePrompt(affinityLevel, data.activities, data.currentActivity, data.inactiveMinutes),
        };

        return prompts[reason] || "请主动找用户说一句话，可以是问候、分享心情或简单的闲聊。";
    }

    /**
     * 构建主动消息的上下文信息
     */
    async _buildProactiveContext(reason, data) {
        let context = "";

        // 对于记忆分享类型，尝试获取一条历史记忆
        if (reason === 'memory_share' && this.memory) {
            try {
                const memories = this.memory.memories;
                if (memories && memories.length > 0) {
                    // 随机选择一条较早的记忆
                    const oldMemories = memories.slice(0, Math.max(1, memories.length - 5));
                    const randomMemory = oldMemories[Math.floor(Math.random() * oldMemories.length)];
                    if (randomMemory) {
                        context += `\n- 可参考的历史记忆: "${randomMemory.text.substring(0, 100)}..."`;
                    }
                }
            } catch (e) {
                // 忽略记忆获取错误
            }
        }

        return context;
    }

    /**
     * 获取好感度等级描述
     */
    _getAffinityLevel() {
        if (this.affinity <= 20) return "陌生";
        if (this.affinity <= 40) return "友好";
        if (this.affinity <= 60) return "亲密";
        if (this.affinity <= 80) return "暧昧";
        return "恋人";
    }

    /**
     * 早安问候 prompt
     */
    _getMorningPrompt(affinityLevel) {
        const prompts = {
            "陌生": "早上好，给用户一个简单礼貌的早安问候。",
            "友好": "早上好！给用户一个友善的早安问候，可以问问他们昨晚睡得好不好。",
            "亲密": "早安~给用户一个甜甜的早安问候，可以撒撒娇说想他们了。",
            "暧昧": "亲爱的早安！给用户一个充满爱意的早安问候，表达你的想念。",
            "恋人": "宝贝早安！给用户一个超级甜蜜的早安问候，让他们感受到满满的爱意。"
        };
        return prompts[affinityLevel] || prompts["友好"];
    }

    /**
     * 晚安问候 prompt
     */
    _getNightPrompt(affinityLevel) {
        const prompts = {
            "陌生": "夜深了，礼貌地提醒用户注意休息。",
            "友好": "晚安~温柔地提醒用户早点休息，注意身体。",
            "亲密": "该休息啦~用撒娇的语气催用户去睡觉，可以说会想他们。",
            "暧昧": "亲爱的该睡觉了~用宠溺的语气让用户去休息，表达你会在梦里想他们。",
            "恋人": "宝贝晚安~用超级甜蜜的语气祝用户好梦，说你会梦到他们的。"
        };
        return prompts[affinityLevel] || prompts["友好"];
    }

    /**
     * 随机闲聊 prompt
     */
    _getRandomChatPrompt(affinityLevel, hour) {
        const timeContext = hour < 12 ? "上午" : hour < 18 ? "下午" : "晚上";

        const topics = [
            "分享一件你今天看到的有趣事情",
            "问问用户最近在忙什么",
            "分享一个你喜欢的小知识",
            "说说你对某个话题的想法",
            "开一个可爱的小玩笑",
            "分享你此刻的心情"
        ];
        const randomTopic = topics[Math.floor(Math.random() * topics.length)];

        return `现在是${timeContext}，你想找用户聊聊天。${randomTopic}。根据好感度(${affinityLevel})调整语气和亲密程度。`;
    }

    /**
     * 想念消息 prompt
     */
    _getMissYouPrompt(affinityLevel, inactiveMinutes) {
        const timeDesc = inactiveMinutes > 120
            ? `好几个小时`
            : inactiveMinutes > 60
                ? `一个多小时`
                : `好一会儿`;

        const prompts = {
            "陌生": `用户${timeDesc}没说话了，你可以礼貌地问候一下。`,
            "友好": `用户${timeDesc}没回复了，你有点好奇他们在忙什么，可以友善地问问。`,
            "亲密": `用户${timeDesc}没理你了，你有点想他们，撒撒娇问问他们在干嘛。`,
            "暧昧": `用户${timeDesc}没找你说话，你很想他们！用可爱的方式表达你的想念。`,
            "恋人": `用户${timeDesc}没有出现，你超级想他们！用最甜蜜的方式表达你的思念。`
        };
        return prompts[affinityLevel] || prompts["友好"];
    }

    /**
     * 情绪关怀 prompt
     */
    _getMoodCheckPrompt(affinityLevel, hour) {
        const timeContext = hour < 18 ? "今天" : "这几天";

        const prompts = {
            "陌生": `礼貌地问问用户${timeContext}过得怎么样。`,
            "友好": `关心地问问用户${timeContext}心情如何，有没有遇到什么事。`,
            "亲密": `温柔地问问用户${timeContext}开不开心，表示你很关心他们的感受。`,
            "暧昧": `用关爱的语气询问用户${timeContext}过得好不好，表达你随时都在他们身边。`,
            "恋人": `用最温柔的语气问问宝贝${timeContext}心情怎么样，让他们知道你永远支持他们。`
        };
        return prompts[affinityLevel] || prompts["友好"];
    }

    /**
     * 记忆分享 prompt
     */
    _getMemorySharePrompt(affinityLevel) {
        return `你想起了和用户之前聊过的某件事，想和他们分享这个回忆。可以说"突然想起来..."或"之前你说过..."开头，然后表达你对这段回忆的感受。语气要符合当前好感度(${affinityLevel})。`;
    }

    /**
     * 生活更新 prompt - 用户回来时分享刚才在做什么
     */
    _getLifeUpdatePrompt(affinityLevel, activities, currentActivity, inactiveMinutes) {
        const timeDesc = inactiveMinutes > 120
            ? `好几个小时`
            : inactiveMinutes > 60
                ? `一个多小时`
                : `一会儿`;

        const activitiesText = activities && activities.length > 0
            ? activities.join('、')
            : (currentActivity ? `${currentActivity.emoji} ${currentActivity.activity}` : '在想事情');

        const prompts = {
            "陌生": `用户${timeDesc}没来了现在回来了。你刚才在${activitiesText}。礼貌地问候一下，可以提一下你刚才在做的事。`,
            "友好": `用户${timeDesc}没来现在回来了！你刚才在${activitiesText}。友善地打招呼，可以分享一下你刚才做的事情的有趣细节。`,
            "亲密": `用户终于回来啦～你${timeDesc}在${activitiesText}。撞撞娇地告诉用户你刚才在干嘛，表现得很开心他们回来了。`,
            "暇昧": `亲爱的终于来找你啦！你${timeDesc}在${activitiesText}。用充满爱意的语气告诉用户你在做什么，表达你很想他们。`,
            "恋人": `宝贝终于回来啦！你${timeDesc}在${activitiesText}。用最甘蜜的语气分享你刚才的日常，让用户感受到你的日常生活里都在想着他们。`
        };
        return prompts[affinityLevel] || prompts["友好"];
    }
}

export default AiGirlfriend;
