"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.predictPunishment = predictPunishment;
exports.predictTimeline = predictTimeline;
const openrouter_1 = require("../config/openrouter");
async function predictPunishment(ipcSections) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 800,
        messages: [
            {
                role: 'user',
                content: `Given these IPC/BNS sections for an Indian court case, predict the aggregate punishment range.

SECTIONS: ${JSON.stringify(ipcSections)}

Return ONLY valid JSON:
{
  "minYears": 0,
  "maxYears": 7,
  "isBailable": false,
  "fineRange": "Up to ₹50,000",
  "disclaimer": "Predictions are based on statute text, not judicial outcomes."
}

Return nothing else.`,
            },
        ],
    });
    const text = response.choices[0]?.message?.content ?? '{}';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    catch {
        console.error('Failed to parse punishment prediction AI response:', text);
        return {
            minYears: 0,
            maxYears: 0,
            isBailable: true,
            fineRange: 'Unknown',
            disclaimer: 'AI prediction unavailable — response could not be parsed.',
        };
    }
}
async function predictTimeline(caseType, ipcSections, courtLocation) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 400,
        messages: [
            {
                role: 'user',
                content: `You are an Indian judiciary expert. Based on historical case data patterns, predict the resolution timeline for a case with:
- Case type: ${caseType}
- IPC Sections: ${ipcSections.join(', ')}
- Court: ${courtLocation}

Return ONLY valid JSON:
{
  "minMonths": 8,
  "maxMonths": 22,
  "medianMonths": 14,
  "confidence": "medium",
  "factors": ["complexity of charges", "documentary evidence required"],
  "disclaimer": "This is an AI estimate based on historical patterns, not a guarantee."
}

Return nothing else.`,
            },
        ],
    });
    const text = response.choices[0]?.message?.content ?? '{}';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    catch {
        console.error('Failed to parse timeline prediction AI response:', text);
        return {
            minMonths: 0,
            maxMonths: 0,
            medianMonths: 0,
            confidence: 'none',
            factors: [],
            disclaimer: 'AI prediction unavailable — response could not be parsed.',
        };
    }
}
