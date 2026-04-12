import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import Case from '../models/Case';
import { parseFIR } from '../agents/parsingAgent';
import { detectIPCSections } from '../agents/legalReasoningAgent';
import { summariseCase } from '../agents/summaryAgent';
import { predictPunishment, predictTimeline } from '../agents/predictionAgent';
import { findSimilarCases } from '../agents/precedentAgent';
import { generateCaseNumber } from '../utils/generateUID';
import { auditLogger } from '../utils/auditLogger';
import { uploadToGridFS } from '../config/gridfs';
const pdfParse = require('pdf-parse');

const router = Router();

// POST /api/fir/upload
// Uploads FIR to GridFS, triggers AI parsing pipeline
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'FIR file is required' });
      return;
    }

    // Extract text from request body natively OR from the uploaded document buffer directly
    let firText = req.body.firText as string || '';

    if (!firText) {
      if (file.mimetype === 'application/pdf') {
        try {
          const pdfData = await pdfParse(file.buffer);
          firText = pdfData.text;
        } catch (e) {
          console.error('PDF parsing error:', e);
          firText = `Failed to parse PDF document.`;
        }
      } else if (file.mimetype === 'text/plain') {
        firText = file.buffer.toString('utf-8');
      } else {
        firText = `FIR Document uploaded: ${file.originalname}. Native text extraction is unsupported for this format.`;
      }
    }

    try {
      // Upload file buffer to GridFS
      const gridfsId = await uploadToGridFS(file.buffer, file.originalname, file.mimetype);

      // Run AI parsing pipeline
      const parsedData = await parseFIR(firText);
      const ipcSections = await detectIPCSections(
        parsedData.offenceDescription,
        parsedData.ipcSectionsRaw ?? []
      );
      const aiSummary = await summariseCase({ parsedData, ipcSections });
      const punishmentPrediction = await predictPunishment(ipcSections);
      const timelinePrediction = await predictTimeline(
        'Criminal',
        ipcSections.map((s) => s.section),
        user.profile.location ?? 'Maharashtra'
      );
      const similarCases = await findSimilarCases(
        parsedData.offenceDescription,
        ipcSections.map((s) => s.section)
      );

      const caseNumber = await generateCaseNumber();

      const newCase = await Case.create({
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

      await auditLogger({
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
    } catch (error) {
      console.error('FIR upload/processing error:', error);
      res.status(500).json({ error: 'Failed to process FIR. Please try again.' });
    }
  }
);

// PATCH /api/fir/:caseId/correct — allow user to fix parsed fields
router.patch('/:caseId/correct', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { corrections } = req.body;
  const user = req.user!;

  try {
    const caseDoc = await Case.findOne({
      _id: req.params.caseId,
      citizenId: user._id,
    });

    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found or access denied' });
      return;
    }

    const updatedCase = await Case.findByIdAndUpdate(
      req.params.caseId,
      {
        $set: {
          ...Object.fromEntries(
            Object.entries(corrections).map(([k, v]) => [`parsedData.${k}`, v])
          ),
          lastActivityAt: new Date(),
        },
      },
      { new: true }
    );

    res.json({ case: updatedCase });
  } catch (error) {
    console.error('FIR correction error:', error);
    res.status(500).json({ error: 'Failed to apply corrections' });
  }
});

export default router;
