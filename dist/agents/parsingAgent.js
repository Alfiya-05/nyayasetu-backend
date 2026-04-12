"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFIR = parseFIR;
const openrouter_1 = require("../config/openrouter");
async function parseFIR(firText) {
    const response = await openrouter_1.openrouterClient.chat.completions.create({
        model: openrouter_1.AI_MODEL,
        max_tokens: 700,
        messages: [
            {
                role: 'user',
                content: `You are a legal document parser for Indian courts. Extract structured data from this FIR document.

FIR CONTENT:
${firText}

Return ONLY a valid JSON object with these exact fields:
{
  "parties": ["complainant name", "accused name"],
  "date": "DD/MM/YYYY",
  "location": "full location string",
  "offenceDescription": "plain text description of the offence. If the text is messy or unstructured, summarize all context here.",
  "firNumber": "FIR number if present or null",
  "policeStation": "police station name if present or null",
  "ipcSectionsRaw": ["any IPC/BNS sections mentioned in the document"]
}

If the document lacks certain fields, use "Unknown" or null. Do not leave the JSON empty. If no text is provided, state "No text was successfully extracted from the document."
Return nothing else — only the JSON object.`,
            },
        ],
    });
    const text = response.choices[0]?.message?.content ?? '{}';
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
    catch {
        console.error('Failed to parse FIR AI response:', text);
        return {
            parties: [],
            date: '',
            location: '',
            offenceDescription: firText,
            firNumber: null,
            policeStation: null,
            ipcSectionsRaw: [],
        };
    }
}
