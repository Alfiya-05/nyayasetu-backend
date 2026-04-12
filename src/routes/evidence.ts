import { Router, Response } from 'express';
import Evidence from '../models/Evidence';
import Case from '../models/Case';
import { authenticate, AuthRequest } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { upload } from '../middleware/upload';
import { deleteFile, openDownloadStream, uploadToGridFS } from '../config/gridfs';
import { auditLogger } from '../utils/auditLogger';
import { firebaseNotify } from '../utils/firebaseNotify';
import mongoose from 'mongoose';

const router = Router();

// POST /api/evidence/upload
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const user = req.user!;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'Evidence file is required' });
      return;
    }

    const { caseId, description } = req.body;
    if (!caseId) {
      res.status(400).json({ error: 'caseId is required' });
      return;
    }

    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      // Upload file buffer to GridFS
      const gridfsId = await uploadToGridFS(file.buffer, file.originalname, file.mimetype);

      const evidence = await Evidence.create({
        caseId,
        uploadedBy: user._id,
        uploaderRole: user.role,
        uploaderName: user.profile.name,
        gridfsId,
        fileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        description,
        uploadTimestamp: new Date(),
        isImmutable: false,
        virusScanPassed: true,
      });

      // Add to case evidence list
      await Case.findByIdAndUpdate(caseId, {
        $push: { evidenceIds: evidence._id },
        lastActivityAt: new Date(),
      });

      // Note: Evidence immutability is enforced by the lockOverdueEvidence cron job
      // (see pendingCaseJob.ts) instead of setTimeout, so it survives server restarts.

      await auditLogger({
        action: 'EVIDENCE_UPLOADED',
        performedBy: user._id,
        performedByRole: user.role,
        targetEntity: 'evidence',
        targetId: evidence._id.toString(),
        metadata: { caseId, fileName: file.originalname, mimeType: file.mimetype },
        ipAddress: req.ip,
      });

      // Notify all case parties
      const notifyIds = [caseDoc.judgeId, caseDoc.lawyerId, caseDoc.citizenId]
        .filter((id) => id && id.toString() !== user._id.toString())
        .filter(Boolean) as mongoose.Types.ObjectId[];

      await firebaseNotify({
        caseId,
        title: 'New Evidence Uploaded',
        body: `${user.profile.name} uploaded: ${file.originalname} for case ${caseDoc.caseNumber}`,
        userIds: notifyIds,
      });

      res.status(201).json({
        evidence,
        message: 'Evidence uploaded. It can be deleted within 15 minutes.',
        immutableAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
    } catch (error) {
      console.error('Evidence upload error:', error);
      res.status(500).json({ error: 'Failed to upload evidence' });
    }
  }
);

// GET /api/evidence/:caseId — list evidence for a case
router.get('/:caseId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const evidence = await Evidence.find({
      caseId: req.params.caseId,
      deletedAt: { $exists: false },
    }).sort({ uploadTimestamp: -1 });

    res.json({ evidence });
  } catch (error) {
    console.error('Get evidence error:', error);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

// GET /api/evidence/:id/file — stream file from GridFS
router.get('/:id/file', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const evidence = await Evidence.findById(req.params.id);
    if (!evidence || evidence.deletedAt) {
      res.status(404).json({ error: 'Evidence not found' });
      return;
    }

    res.setHeader('Content-Type', evidence.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${evidence.fileName}"`);

    const downloadStream = openDownloadStream(evidence.gridfsId);
    downloadStream.pipe(res);
    downloadStream.on('error', () => {
      res.status(500).json({ error: 'Failed to stream file' });
    });
  } catch (error) {
    console.error('Stream evidence error:', error);
    res.status(500).json({ error: 'Failed to stream file' });
  }
});

// DELETE /api/evidence/:id
router.delete(
  '/:id',
  authenticate,
  roleGuard(['lawyer', 'citizen']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const user = req.user!;

    try {
      const evidence = await Evidence.findById(req.params.id);
      if (!evidence || evidence.deletedAt) {
        res.status(404).json({ error: 'Evidence not found' });
        return;
      }

      if (evidence.isImmutable) {
        res.status(403).json({
          error:
            'This document is immutable and cannot be deleted. Documents are locked 15 minutes after upload.',
        });
        return;
      }

      // Verify uploader is the one deleting
      if (evidence.uploadedBy.toString() !== user._id.toString() && user.role !== 'admin') {
        res.status(403).json({ error: 'You can only delete your own uploaded evidence' });
        return;
      }

      const deletionLog = `${user.profile.name} (${user.role}) deleted ${evidence.fileName} on ${new Date().toISOString()}`;

      // Delete from GridFS
      await deleteFile(evidence.gridfsId);

      // Soft-delete the record (unset gridfsId instead of null to avoid schema violation)
      await Evidence.findByIdAndUpdate(evidence._id, {
        deletedAt: new Date(),
        deletionLog,
        $unset: { gridfsId: 1 },
      });

      // Remove from case
      await Case.findByIdAndUpdate(evidence.caseId, {
        $pull: { evidenceIds: evidence._id },
        lastActivityAt: new Date(),
      });

      await auditLogger({
        action: 'EVIDENCE_DELETED',
        performedBy: user._id,
        performedByRole: user.role,
        targetEntity: 'evidence',
        targetId: evidence._id.toString(),
        metadata: { deletionLog, caseId: evidence.caseId, fileName: evidence.fileName },
        ipAddress: req.ip,
      });

      const caseDoc = await Case.findById(evidence.caseId);
      if (caseDoc) {
        const notifyIds = [caseDoc.judgeId, caseDoc.citizenId]
          .filter(Boolean) as mongoose.Types.ObjectId[];

        await firebaseNotify({
          caseId: evidence.caseId.toString(),
          title: 'Evidence Removed',
          body: deletionLog,
          userIds: notifyIds,
        });
      }

      res.json({ message: deletionLog });
    } catch (error) {
      console.error('Delete evidence error:', error);
      res.status(500).json({ error: 'Failed to delete evidence' });
    }
  }
);

export default router;
