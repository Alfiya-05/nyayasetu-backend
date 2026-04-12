import { Router, Response } from 'express';
import Hearing from '../models/Hearing';
import Case from '../models/Case';
import { authenticate, AuthRequest } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { auditLogger } from '../utils/auditLogger';
import { firebaseNotify } from '../utils/firebaseNotify';
import mongoose from 'mongoose';

const router = Router();

// POST /api/hearings — judge creates a hearing
router.post(
  '/',
  authenticate,
  roleGuard(['judge']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { caseId, hearingDate, courtRoom, notes } = req.body;
    const user = req.user!;

    if (!caseId || !hearingDate) {
      res.status(400).json({ error: 'caseId and hearingDate are required' });
      return;
    }

    try {
      const caseDoc = await Case.findById(caseId);
      if (!caseDoc) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      const hearing = await Hearing.create({
        caseId,
        judgeId: user._id,
        lawyerId: caseDoc.lawyerId,
        citizenId: caseDoc.citizenId,
        hearingDate: new Date(hearingDate),
        courtRoom,
        notes,
        status: 'scheduled',
      });

      // Add to case
      await Case.findByIdAndUpdate(caseId, {
        $push: { hearings: hearing._id },
        lastActivityAt: new Date(),
      });

      await auditLogger({
        action: 'HEARING_CREATED',
        performedBy: user._id,
        performedByRole: user.role,
        targetEntity: 'hearing',
        targetId: hearing._id.toString(),
        metadata: { caseId, hearingDate, courtRoom },
        ipAddress: req.ip,
      });

      const notifyIds = [caseDoc.lawyerId, caseDoc.citizenId].filter(
        Boolean
      ) as mongoose.Types.ObjectId[];

      await firebaseNotify({
        caseId,
        title: 'Hearing Scheduled',
        body: `Hearing for case ${caseDoc.caseNumber} scheduled on ${new Date(hearingDate).toLocaleDateString('en-IN')} in ${courtRoom ?? 'TBD'}`,
        userIds: notifyIds,
      });

      res.status(201).json({ hearing });
    } catch (error) {
      console.error('Create hearing error:', error);
      res.status(500).json({ error: 'Failed to schedule hearing' });
    }
  }
);

// PATCH /api/hearings/:id — judge updates hearing
router.patch(
  '/:id',
  authenticate,
  roleGuard(['judge']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { hearingDate, courtRoom, status, notes } = req.body;
    const user = req.user!;

    try {
      const updates: Record<string, unknown> = {};
      if (hearingDate) updates.hearingDate = new Date(hearingDate);
      if (courtRoom) updates.courtRoom = courtRoom;
      if (status) updates.status = status;
      if (notes !== undefined) updates.notes = notes;

      const hearing = await Hearing.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!hearing) {
        res.status(404).json({ error: 'Hearing not found' });
        return;
      }

      await auditLogger({
        action: 'HEARING_UPDATED',
        performedBy: user._id,
        performedByRole: user.role,
        targetEntity: 'hearing',
        targetId: hearing._id.toString(),
        metadata: updates,
        ipAddress: req.ip,
      });

      const caseDoc = await Case.findByIdAndUpdate(hearing.caseId, {
        lastActivityAt: new Date(),
      });

      if (caseDoc) {
        const notifyIds = [hearing.lawyerId, hearing.citizenId].filter(
          Boolean
        ) as mongoose.Types.ObjectId[];

        await firebaseNotify({
          caseId: hearing.caseId.toString(),
          title: 'Hearing Updated',
          body: `Hearing for case ${caseDoc.caseNumber} has been updated${hearingDate ? ` to ${new Date(hearingDate).toLocaleDateString('en-IN')}` : ''}`,
          userIds: notifyIds,
        });
      }

      res.json({ hearing });
    } catch (error) {
      console.error('Update hearing error:', error);
      res.status(500).json({ error: 'Failed to update hearing' });
    }
  }
);

// GET /api/hearings/judge/:judgeId — all hearings for judge (calendar)
router.get('/judge/:judgeId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hearings = await Hearing.find({ judgeId: req.params.judgeId })
      .populate('caseId', 'caseNumber status')
      .sort({ hearingDate: 1 });

    res.json({ hearings });
  } catch (error) {
    console.error('Get judge hearings error:', error);
    res.status(500).json({ error: 'Failed to fetch hearings' });
  }
});

// GET /api/hearings/case/:caseId — all hearings for a case
router.get('/case/:caseId', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const hearings = await Hearing.find({ caseId: req.params.caseId }).sort({ hearingDate: 1 });
    res.json({ hearings });
  } catch (error) {
    console.error('Get case hearings error:', error);
    res.status(500).json({ error: 'Failed to fetch hearings' });
  }
});

export default router;
