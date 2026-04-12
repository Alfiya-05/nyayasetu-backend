"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const Case_1 = __importDefault(require("../models/Case"));
const parsingAgent_1 = require("../agents/parsingAgent");
const legalReasoningAgent_1 = require("../agents/legalReasoningAgent");
const summaryAgent_1 = require("../agents/summaryAgent");
const predictionAgent_1 = require("../agents/predictionAgent");
const precedentAgent_1 = require("../agents/precedentAgent");
const generateUID_1 = require("../utils/generateUID");
const auditLogger_1 = require("../utils/auditLogger");
const gridfs_1 = require("../config/gridfs");
const pdfParse = require('pdf-parse');
const router = (0, express_1.Router)();
// POST /api/fir/upload
// Uploads FIR to GridFS, triggers AI parsing pipeline
router.post('/upload', auth_1.authenticate, upload_1.upload.single('file'), async (req, res) => {
    const user = req.user;
    const file = req.file;
    if (!file) {
        res.status(400).json({ error: 'FIR file is required' });
        return;
    }
    // Extract text from request body natively OR from the uploaded document buffer directly
    let firText = req.body.firText || '';
    if (!firText) {
        if (file.mimetype === 'application/pdf') {
            try {
                const pdfData = await pdfParse(file.buffer);
                firText = pdfData.text;
            }
            catch (e) {
                console.error('PDF parsing error:', e);
                firText = `Failed to parse PDF document.`;
            }
        }
        else if (file.mimetype === 'text/plain') {
            firText = file.buffer.toString('utf-8');
        }
        else {
            firText = `FIR Document uploaded: ${file.originalname}. Native text extraction is unsupported for this format.`;
        }
    }
    try {
        // Upload file buffer to GridFS
        const gridfsId = await (0, gridfs_1.uploadToGridFS)(file.buffer, file.originalname, file.mimetype);
        // Run AI parsing pipeline
        const parsedData = await (0, parsingAgent_1.parseFIR)(firText);
        const ipcSections = await (0, legalReasoningAgent_1.detectIPCSections)(parsedData.offenceDescription, parsedData.ipcSectionsRaw ?? []);
        const aiSummary = await (0, summaryAgent_1.summariseCase)({ parsedData, ipcSections });
        const punishmentPrediction = await (0, predictionAgent_1.predictPunishment)(ipcSections);
        const timelinePrediction = await (0, predictionAgent_1.predictTimeline)('Criminal', ipcSections.map((s) => s.section), user.profile.location ?? 'Maharashtra');
        const similarCases = await (0, precedentAgent_1.findSimilarCases)(parsedData.offenceDescription, ipcSections.map((s) => s.section));
        const caseNumber = await (0, generateUID_1.generateCaseNumber)();
        const newCase = await Case_1.default.create({
            caseNumber,
            citizenId: user._id,
            firGridfsId: gridfsId,
            parsedData: {
                ...parsedData,
                ipcSectionsRaw: parsedData.ipcSectionsRaw ?? [],
            },
            ipcSections,
            aiSummary,
            punishmentPrediction,
            timelinePrediction,
            similarCases,
            status: 'unassigned',
            lastActivityAt: new Date(),
        });
        await (0, auditLogger_1.auditLogger)({
            action: 'FIR_UPLOADED',
            performedBy: user._id,
            performedByRole: user.role,
            targetEntity: 'case',
            targetId: newCase._id.toString(),
            metadata: { caseNumber, fileName: file.originalname },
            ipAddress: req.ip,
        });
        res.status(201).json({
            case: newCase,
            message: 'FIR uploaded and processed successfully',
        });
    }
    catch (error) {
        console.error('FIR upload/processing error:', error);
        res.status(500).json({ error: 'Failed to process FIR. Please try again.' });
    }
});
// PATCH /api/fir/:caseId/correct — allow user to fix parsed fields
router.patch('/:caseId/correct', auth_1.authenticate, async (req, res) => {
    const { corrections } = req.body;
    const user = req.user;
    try {
        const caseDoc = await Case_1.default.findOne({
            _id: req.params.caseId,
            citizenId: user._id,
        });
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found or access denied' });
            return;
        }
        const updatedCase = await Case_1.default.findByIdAndUpdate(req.params.caseId, {
            $set: {
                ...Object.fromEntries(Object.entries(corrections).map(([k, v]) => [`parsedData.${k}`, v])),
                lastActivityAt: new Date(),
            },
        }, { new: true });
        res.json({ case: updatedCase });
    }
    catch (error) {
        console.error('FIR correction error:', error);
        res.status(500).json({ error: 'Failed to apply corrections' });
    }
});
exports.default = router;
