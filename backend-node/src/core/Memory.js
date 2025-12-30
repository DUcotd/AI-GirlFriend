import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class Memory {
    constructor(persistDirectory = "memory_db", config = {}) {
        // Path configuration
        this.dbPath = path.resolve(process.cwd(), '..', persistDirectory, 'memory.json');

        // Ensure dir exists
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        // OpenAI configuration for embeddings
        console.log("[Memory] Initializing with config keys:", Object.keys(config));

        // 优先级：专用配置 > 主配置 > 默认值 (API Key 需通过前端设置页面配置)
        this.apiKey = config.embeddingApiKey || config.apiKey || null;
        this.baseUrl = config.embeddingBaseUrl || config.baseUrl || "https://api.openai.com/v1";
        this.embeddingModel = config.embeddingModelName || "text-embedding-3-small";

        // 特殊处理：如果 Base URL 包含 siliconflow 但模型还是默认的 OpenAI 模型，则自动修正
        if (this.baseUrl.includes("siliconflow") && this.embeddingModel === "text-embedding-3-small") {
            this.embeddingModel = "BAAI/bge-large-zh-v1.5";
        }

        this.openai = null;

        if (this.apiKey) {
            this.initOpenAI();
        }

        this.memories = this._load();
    }

    initOpenAI() {
        // 自动清洗 URL: 如果用户填了带 /embeddings 的全路径，自动去掉后缀
        // 因为 OpenAI SDK 会自动补全 /embeddings
        let cleanBaseUrl = this.baseUrl.replace(/\/embeddings\/?$/, "");

        console.log(`[Memory] Creating OpenAI client with BaseURL: ${cleanBaseUrl}`);

        this.openai = new OpenAI({
            apiKey: this.apiKey,
            baseURL: cleanBaseUrl
        });
    }

    /**
     * Update OpenAI client configuration
     */
    updateConfig(config) {
        if (config.embeddingApiKey) this.apiKey = config.embeddingApiKey;
        else if (config.apiKey) this.apiKey = config.apiKey;

        if (config.embeddingBaseUrl) this.baseUrl = config.embeddingBaseUrl;
        else if (config.baseUrl) this.baseUrl = config.baseUrl;

        if (config.embeddingModelName) this.embeddingModel = config.embeddingModelName;

        if (this.apiKey) {
            this.initOpenAI();
        }
    }

    _load() {
        if (!fs.existsSync(this.dbPath)) {
            return [];
        }
        try {
            const data = fs.readFileSync(this.dbPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Memory Load Error: ${e}`);
            return [];
        }
    }

    _save() {
        try {
            fs.writeFileSync(this.dbPath, JSON.stringify(this.memories, null, 2), 'utf-8');
        } catch (e) {
            console.error(`Memory Save Error: ${e}`);
        }
    }

    /**
     * Get embedding vector for text using OpenAI API
     */
    async getEmbedding(text) {
        if (!this.openai) {
            console.warn("[Memory] OpenAI not configured, skipping embedding");
            return null;
        }

        try {
            console.log(`[Memory] Requesting embedding: model=${this.embeddingModel}, url=${this.baseUrl}`);
            const response = await this.openai.embeddings.create({
                model: this.embeddingModel,
                input: text,
            });
            console.log("[Memory] Embedding generated successfully.");
            return response.data[0].embedding;
        } catch (e) {
            console.error(`[Memory] Embedding Error: ${e.message}`);
            if (e.response) {
                console.error(`[Memory] API Response: ${JSON.stringify(e.response.data)}`);
            }
            if (e.status === 404) {
                console.warn("[Memory] 404: The configured endpoint or model does not support embeddings.");
                return null;
            }
            return null;
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     */
    cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /**
     * Add a memory entry with embedding and emotion snapshot
     */
    async addMemory(text, metadata = null) {
        if (!text || !text.trim()) return;

        // Get embedding for the text
        const embedding = await this.getEmbedding(text);

        const entry = {
            id: uuidv4(),
            text: text,
            embedding: embedding, // Can be null if API fails
            metadata: metadata || { type: "conversation" },
            emotionSnapshot: metadata?.emotionSnapshot || null, // PAD情感快照
            timestamp: Date.now() / 1000
        };

        this.memories.push(entry);
        this._save();
        console.log(`[Memory] Stored: ${text.substring(0, 50)}... (embedding: ${embedding ? 'yes' : 'no'}, emotion: ${entry.emotionSnapshot ? 'yes' : 'no'})`);
    }

    /**
     * Get relevant context using vector similarity + emotion resonance
     * Falls back to keyword matching if embeddings unavailable
     * @param {string} query - 查询文本
     * @param {Object} currentEmotion - 当前PAD情感状态 {P, A, D}
     * @param {number} nResults - 返回结果数
     */
    async getRelevantContext(query, currentEmotion = null, nResults = 3) {
        if (!this.memories || this.memories.length === 0) return "";

        // Try vector similarity first
        const queryEmbedding = await this.getEmbedding(query);

        if (queryEmbedding) {
            // Use vector similarity + emotion resonance
            const scoredMemories = [];

            for (const mem of this.memories) {
                if (mem.embedding) {
                    const semanticScore = this.cosineSimilarity(queryEmbedding, mem.embedding);
                    let emotionScore = 0;

                    // 情感共鸣计算
                    if (currentEmotion && mem.emotionSnapshot) {
                        emotionScore = this._emotionSimilarity(currentEmotion, mem.emotionSnapshot);
                    }

                    // 悲伤时更容易想起悲伤的事（翻旧账机制）
                    const emotionWeight = currentEmotion && currentEmotion.P < 0 ? 0.4 : 0.2;
                    const combinedScore = semanticScore + emotionScore * emotionWeight;

                    scoredMemories.push({
                        score: combinedScore,
                        semanticScore,
                        emotionScore,
                        text: mem.text
                    });
                }
            }

            if (scoredMemories.length > 0) {
                // Sort by combined score (descending)
                scoredMemories.sort((a, b) => b.score - a.score);

                // Filter by minimum threshold (0.3) and take top N
                const relevantMemories = scoredMemories
                    .filter(m => m.semanticScore > 0.3)
                    .slice(0, nResults);

                if (relevantMemories.length > 0) {
                    console.log(`[Memory] Vector search found ${relevantMemories.length} results (top score: ${relevantMemories[0].score.toFixed(3)}, emotion influence: ${relevantMemories[0].emotionScore.toFixed(2)})`);
                    return relevantMemories.map(m => m.text).join("\n");
                }
            }
        }

        // Fallback to keyword matching
        console.log("[Memory] Falling back to keyword matching");
        return this._keywordSearch(query, nResults);
    }

    /**
     * 计算情感相似度
     */
    _emotionSimilarity(e1, e2) {
        if (!e1 || !e2) return 0;
        // 计算PAD空间中的距离，转换为相似度
        const pDiff = Math.abs((e1.P || 0) - (e2.P || 0));
        const aDiff = Math.abs((e1.A || 0) - (e2.A || 0));
        const dDiff = Math.abs((e1.D || 0) - (e2.D || 0));
        // 最大差异是4（从-1到1各差2，三个维度）
        return 1 - (pDiff + aDiff + dDiff) / 6;
    }

    /**
     * Legacy keyword-based search (fallback)
     */
    _keywordSearch(query, nResults = 3) {
        const queryWords = new Set(query.toLowerCase().split(/\s+/));
        const scoredMemories = [];

        for (const mem of this.memories) {
            let score = 0;
            const textLower = mem.text.toLowerCase();
            queryWords.forEach(word => {
                if (textLower.includes(word)) score++;
            });

            if (score > 0) {
                scoredMemories.push({ score, text: mem.text });
            }
        }

        // Sort desc
        scoredMemories.sort((a, b) => b.score - a.score);

        const topMemories = scoredMemories.slice(0, nResults).map(m => m.text);
        return topMemories.join("\n");
    }

    /**
     * Get all memories (for API)
     */
    getAllMemories() {
        return this.memories;
    }

    clearMemory() {
        this.memories = [];
        this._save();
    }
}

export default Memory;
