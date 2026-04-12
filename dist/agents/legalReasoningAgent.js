"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectIPCSections = detectIPCSections;
const openrouter_1 = require("../config/openrouter");
async function detectIPCSections(offenceDescription, rawSections) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 700,
        messages: [
            {
                role: 'user',
                content: `You are an Indian legal expert. Given this offence description and any sections already mentioned in the FIR, identify all applicable IPC/BNS sections.

OFFENCE DESCRIPTION:
${offenceDescription}

SECTIONS MENTIONED IN FIR: ${rawSections.length > 0 ? rawSections.join(', ') : 'None mentioned'}

Return ONLY a valid JSON array with objects like:
[{
  "section": "420",
  "act": "IPC",
  "title": "Cheating and dishonestly inducing delivery of property",
  "description": "One sentence plain-language description",
  "isCognizable": true,
  "isBailable": false,
  "minPunishmentYears": 0,
  "maxPunishmentYears": 7,
  "fineApplicable": true
}]

Return nothing else — only the JSON array.`,
            },
        ],
    });
    const text = response.choices[0]?.message?.content ?? '[]';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    catch {
        console.error('Failed to parse IPC sections AI response:', text);
        return [];
    }
}
