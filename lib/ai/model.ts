import { createOpenAI } from '@ai-sdk/openai';

// Create an OpenAI-compatible client for Alibaba Qwen
const apiKey = process.env.QWEN_API_KEY;
console.log('[Model Config] Initializing Qwen Client');
console.log('[Model Config] API Key exists:', !!apiKey);
console.log('[Model Config] API Key length:', apiKey?.length);

const qwenClient = createOpenAI({
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKey: apiKey,
});

// Export the specific model instance
// 'qwen-plus' is a balanced model (good for general tasks)
// 'qwen-max' is the most capable model (good for complex reasoning)
export const qwen = qwenClient.chat('qwen-plus');

// Export qwen-max for deep analysis tasks
export const qwenMax = qwenClient.chat('qwen-max');
