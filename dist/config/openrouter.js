"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_MODEL = exports.openrouterClient = void 0;
const openai_1 = __importDefault(require("openai"));
exports.openrouterClient = new openai_1.default({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'NyayaSetu',
    },
});
exports.AI_MODEL = 'anthropic/claude-sonnet-4-5';
