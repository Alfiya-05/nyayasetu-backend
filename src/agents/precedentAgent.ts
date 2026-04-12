import { openrouterClient, AI_MODEL } from '../config/openrouter';

export interface SimilarCase {
  caseId: string;
  caseName: string;
  year: number;
  court: string;
  outcome: string;
  similarityScore: number;
}

export async function findSimilarCases(
  offenceDescription: string,
  ipcSections: string[]
): Promise<SimilarCase[]> {
  const response = await openrouterClient.chat.completions.create({
    model: AI_MODEL,
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
    return JSON.parse(text.replace(/```json|```/g, '').trim()) as SimilarCase[];
  } catch {
    console.error('Failed to parse similar cases AI response:', text);
    return [];
  }
}
