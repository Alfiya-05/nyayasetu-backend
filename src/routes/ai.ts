import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import Case from '../models/Case';
import { summariseCase } from '../agents/summaryAgent';
import { detectIPCSections } from '../agents/legalReasoningAgent';
import { predictPunishment, predictTimeline } from '../agents/predictionAgent';
import { findSimilarCases } from '../agents/precedentAgent';
import { chat, ChatMessage } from '../agents/chatAgent';

const router = Router();

// Apply AI rate limiter to all routes
router.use(aiLimiter);

// POST /api/ai/summarise
router.post('/summarise', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId } = req.body;
  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) { res.status(404).json({ error: 'Case not found' }); return; }

    const summary = await summariseCase({
      parsedData: caseDoc.parsedData,
      ipcSections: caseDoc.ipcSections,
      hearings: [],
    });

    await Case.findByIdAndUpdate(caseId, { aiSummary: summary, lastActivityAt: new Date() });
    res.json({ summary });
  } catch (error) {
    console.error('Summarise error:', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// POST /api/ai/detect-ipc
router.post('/detect-ipc', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId } = req.body;
  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) { res.status(404).json({ error: 'Case not found' }); return; }

    const ipcSections = await detectIPCSections(
      caseDoc.parsedData.offenceDescription,
      caseDoc.parsedData.ipcSectionsRaw ?? []
    );

    await Case.findByIdAndUpdate(caseId, { ipcSections, lastActivityAt: new Date() });
    res.json({ ipcSections });
  } catch (error) {
    console.error('Detect IPC error:', error);
    res.status(500).json({ error: 'Failed to detect IPC sections' });
  }
});

// POST /api/ai/predict-punishment
router.post('/predict-punishment', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId } = req.body;
  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) { res.status(404).json({ error: 'Case not found' }); return; }

    const punishmentPrediction = await predictPunishment(caseDoc.ipcSections);
    await Case.findByIdAndUpdate(caseId, { punishmentPrediction, lastActivityAt: new Date() });
    res.json({ punishmentPrediction });
  } catch (error) {
    console.error('Predict punishment error:', error);
    res.status(500).json({ error: 'Failed to predict punishment' });
  }
});

// POST /api/ai/predict-timeline
router.post('/predict-timeline', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId } = req.body;
  try {
    const caseDoc = await Case.findById(caseId).populate('judgeId', 'profile.courtId');
    if (!caseDoc) { res.status(404).json({ error: 'Case not found' }); return; }

    const timelinePrediction = await predictTimeline(
      'Criminal',
      caseDoc.ipcSections.map((s) => s.section),
      caseDoc.parsedData.location ?? 'Maharashtra'
    );

    await Case.findByIdAndUpdate(caseId, { timelinePrediction, lastActivityAt: new Date() });
    res.json({ timelinePrediction });
  } catch (error) {
    console.error('Predict timeline error:', error);
    res.status(500).json({ error: 'Failed to predict timeline' });
  }
});

// POST /api/ai/similar-cases
router.post('/similar-cases', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId } = req.body;
  try {
    const caseDoc = await Case.findById(caseId);
    if (!caseDoc) { res.status(404).json({ error: 'Case not found' }); return; }

    const similarCases = await findSimilarCases(
      caseDoc.parsedData.offenceDescription,
      caseDoc.ipcSections.map((s) => s.section)
    );

    await Case.findByIdAndUpdate(caseId, { similarCases, lastActivityAt: new Date() });
    res.json({ similarCases });
  } catch (error) {
    console.error('Similar cases error:', error);
    res.status(500).json({ error: 'Failed to find similar cases' });
  }
});

// POST /api/ai/chat
router.post('/chat', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { caseId, message, history } = req.body;
  const user = req.user!;

  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  try {
    let caseContext = {};
    if (caseId) {
      const caseDoc = await Case.findById(caseId).select(
        'caseNumber parsedData ipcSections aiSummary status punishmentPrediction timelinePrediction'
      );
      if (caseDoc) caseContext = caseDoc.toObject();
    }

    const role = user.role as 'citizen' | 'lawyer' | 'judge';
    const chatHistory: ChatMessage[] = Array.isArray(history) ? history : [];

    const reply = await chat(role, message, caseContext, chatHistory);
    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process chat message' });
  }
});

export default router;
