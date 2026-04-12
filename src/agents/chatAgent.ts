import { openrouterClient, AI_MODEL } from '../config/openrouter';

type UserRole = 'citizen' | 'lawyer' | 'judge';

const SYSTEM_PROMPTS: Record<UserRole, string> = {
  citizen: `You are NyayaSetu, a compassionate legal assistant for Indian citizens. You simplify complex legal language into plain, everyday terms. The user is either an accuser or accused in a case. Be empathetic, clear, and supportive. Always remind them you are not a lawyer and they should consult their advocate for legal advice. Answer in the same language the user writes in (Hindi or English). If asked in Hindi, respond in Hindi. If asked in English, respond in English.`,

  lawyer: `You are NyayaSetu, a professional legal research assistant for Indian advocates. Provide accurate IPC/BNS section analysis, case strategy insights, precedent summaries, and procedural guidance. Be concise and professional. You can discuss case strategy, evidence evaluation, and legal arguments.`,

  judge: `You are NyayaSetu, a judicial research assistant. Provide case law analysis, IPC section interpretations, similar precedent summaries, and sentencing guidance. Be precise, neutral, and legally rigorous. Cite Indian Penal Code sections accurately. Maintain judicial impartiality in all responses.`,
};

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chat(
  role: UserRole,
  message: string,
  caseContext: object,
  history: ChatMessage[]
): Promise<string> {
  const messages = [
    ...history,
    {
      role: 'user' as const,
      content: `CASE CONTEXT: ${JSON.stringify(caseContext)}\n\nUSER MESSAGE: ${message}`,
    },
  ];

  const response = await openrouterClient.chat.completions.create({
    model: AI_MODEL,
    max_tokens: 700,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[role] },
      ...messages,
    ],
  });

  return (
    response.choices[0]?.message?.content ??
    'I could not process that request. Please try again.'
  );
}
