import OpenAI from 'openai';

export const openrouterClient = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
    'X-Title': 'NyayaSetu',
  },
});

export const AI_MODEL = 'anthropic/claude-sonnet-4-5';
