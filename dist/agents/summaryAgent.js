"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.summariseCase = summariseCase;
const openrouter_1 = require("../config/openrouter");
async function summariseCase(caseData) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 700,
        messages: [
            {
                role: 'user',
                content: `You are a legal AI assistant for the Indian judiciary. Summarise this case in simple, plain language for a citizen who has no legal background. Avoid jargon. Use short sentences. Be empathetic and clear.

CASE DATA:
${JSON.stringify(caseData, null, 2)}

Write a summary of 150-200 words. Do NOT start with "This case involves". Start directly with what happened. 
If the data is sparse or incomplete, infer what you can and simplify it unconditionally. Never apologize or say you cannot provide a summary—just summarize the offenceDescription. End with: "Disclaimer: This is an AI-generated summary and not legal advice."`,
            },
        ],
    });
    return response.choices[0]?.message?.content ?? 'Unable to generate summary at this time.';
}
