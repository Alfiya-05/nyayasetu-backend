"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const Case_1 = __importDefault(require("../models/Case"));
const summaryAgent_1 = require("../agents/summaryAgent");
const legalReasoningAgent_1 = require("../agents/legalReasoningAgent");
const predictionAgent_1 = require("../agents/predictionAgent");
const precedentAgent_1 = require("../agents/precedentAgent");
const chatAgent_1 = require("../agents/chatAgent");
const router = (0, express_1.Router)();
// Apply AI rate limiter to all routes
router.use(rateLimiter_1.aiLimiter);
// POST /api/ai/summarise
router.post('/summarise', auth_1.authenticate, async (req, res) => {
    const { caseId } = req.body;
    try {
        const caseDoc = await Case_1.default.findById(caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const summary = await (0, summaryAgent_1.summariseCase)({
            parsedData: caseDoc.parsedData,
            ipcSections: caseDoc.ipcSections,
            hearings: [],
        });
        await Case_1.default.findByIdAndUpdate(caseId, { aiSummary: summary, lastActivityAt: new Date() });
        res.json({ summary });
    }
    catch (error) {
        console.error('Summarise error:', error);
        res.status(500).json({ error: 'Failed to generate summary' });
    }
});
// POST /api/ai/detect-ipc
router.post('/detect-ipc', auth_1.authenticate, async (req, res) => {
    const { caseId } = req.body;
    try {
        const caseDoc = await Case_1.default.findById(caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const ipcSections = await (0, legalReasoningAgent_1.detectIPCSections)(caseDoc.parsedData.offenceDescription, caseDoc.parsedData.ipcSectionsRaw ?? []);
        await Case_1.default.findByIdAndUpdate(caseId, { ipcSections, lastActivityAt: new Date() });
        res.json({ ipcSections });
    }
    catch (error) {
        console.error('Detect IPC error:', error);
        res.status(500).json({ error: 'Failed to detect IPC sections' });
    }
});
// POST /api/ai/predict-punishment
router.post('/predict-punishment', auth_1.authenticate, async (req, res) => {
    const { caseId } = req.body;
    try {
        const caseDoc = await Case_1.default.findById(caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const punishmentPrediction = await (0, predictionAgent_1.predictPunishment)(caseDoc.ipcSections);
        await Case_1.default.findByIdAndUpdate(caseId, { punishmentPrediction, lastActivityAt: new Date() });
        res.json({ punishmentPrediction });
    }
    catch (error) {
        console.error('Predict punishment error:', error);
        res.status(500).json({ error: 'Failed to predict punishment' });
    }
});
// POST /api/ai/predict-timeline
router.post('/predict-timeline', auth_1.authenticate, async (req, res) => {
    const { caseId } = req.body;
    try {
        const caseDoc = await Case_1.default.findById(caseId).populate('judgeId', 'profile.courtId');
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const timelinePrediction = await (0, predictionAgent_1.predictTimeline)('Criminal', caseDoc.ipcSections.map((s) => s.section), caseDoc.parsedData.location ?? 'Maharashtra');
        await Case_1.default.findByIdAndUpdate(caseId, { timelinePrediction, lastActivityAt: new Date() });
        res.json({ timelinePrediction });
    }
    catch (error) {
        console.error('Predict timeline error:', error);
        res.status(500).json({ error: 'Failed to predict timeline' });
    }
});
// POST /api/ai/similar-cases
router.post('/similar-cases', auth_1.authenticate, async (req, res) => {
    const { caseId } = req.body;
    try {
        const caseDoc = await Case_1.default.findById(caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const similarCases = await (0, precedentAgent_1.findSimilarCases)(caseDoc.parsedData.offenceDescription, caseDoc.ipcSections.map((s) => s.section));
        await Case_1.default.findByIdAndUpdate(caseId, { similarCases, lastActivityAt: new Date() });
        res.json({ similarCases });
    }
    catch (error) {
        console.error('Similar cases error:', error);
        res.status(500).json({ error: 'Failed to find similar cases' });
    }
});
// POST /api/ai/chat
router.post('/chat', auth_1.authenticate, async (req, res) => {
    const { caseId, message, history } = req.body;
    const user = req.user;
    if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
    }
    try {
        let caseContext = {};
        if (caseId) {
            const caseDoc = await Case_1.default.findById(caseId).select('caseNumber parsedData ipcSections aiSummary status punishmentPrediction timelinePrediction');
            if (caseDoc)
                caseContext = caseDoc.toObject();
        }
        const role = user.role;
        const chatHistory = Array.isArray(history) ? history : [];
        const reply = await (0, chatAgent_1.chat)(role, message, caseContext, chatHistory);
        res.json({ reply });
    }
    catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});
exports.default = router;
