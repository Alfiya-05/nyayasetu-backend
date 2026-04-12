"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findSimilarCases = findSimilarCases;
const openrouter_1 = require("../config/openrouter");
async function findSimilarCases(offenceDescription, ipcSections) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 700,
        messages: [
            {
                role: 'user',
                content: `You are an Indian legal research assistant. Based on the offence description and IPC sections, identify 3-5 landmark or relevant Indian court cases that are most similar.

OFFENCE DESCRIPTION: ${offenceDescription}
IPC SECTIONS: ${ipcSections.join(', ')}

Return ONLY a valid JSON array:
[{
  "caseId": "unique_id_string",
  "caseName": "State vs Accused Name (Year)",
  "year": 2019,
  "court": "Supreme Court of India",
  "outcome": "Convicted under IPC 420, sentenced to 3 years rigorous imprisonment",
  "similarityScore": 0.87
}]

Use real Indian case law where possible. Similarity score should be between 0 and 1. Return nothing else.`,
            },
        ],
    });
    const text = response.choices[0]?.message?.content ?? '[]';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    catch {
        console.error('Failed to parse similar cases AI response:', text);
        return [];
    }
}
