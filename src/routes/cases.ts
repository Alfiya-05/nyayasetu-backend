import { Router, Response } from 'express';
import Case from '../models/Case';
import { authenticate, AuthRequest } from '../middleware/auth';
import { auditLogger } from '../utils/auditLogger';
import { firebaseNotify } from '../utils/firebaseNotify';
import mongoose from 'mongoose';

const router = Router();

// GET /api/cases — role-filtered case list
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  const { status } = req.query;

  let query: Record<string, unknown> = {};

  if (user.role === 'citizen') {
    query.citizenId = user._id;
  } else if (user.role === 'lawyer') {
    query.lawyerId = user._id;
  } else if (user.role === 'judge') {
    query.judgeId = user._id;
  }
  // admin sees all

  if (status) query.status = status;

  try {
    const cases = await Case.find(query)
      .populate('citizenId', 'profile.name email systemUid')
      .populate('lawyerId', 'profile.name email systemUid')
      .populate('judgeId', 'profile.name email systemUid')
      .sort({ updatedAt: -1 });

    res.json({ cases });
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// GET /api/cases/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const caseDoc = await Case.findById(req.params.id)
      .populate('citizenId', 'profile email systemUid')
      .populate('lawyerId', 'profile email systemUid')
      .populate('judgeId', 'profile email systemUid')
      .populate('hearings')
      .populate('evidenceIds');

    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    // Access control: only parties involved or admins can view
    const user = req.user!;
    const userId = user._id.toString();
    const isParty =
      caseDoc.citizenId?._id?.toString() === userId ||
      caseDoc.lawyerId?._id?.toString() === userId ||
      caseDoc.judgeId?._id?.toString() === userId;

    if (user.role !== 'admin' && !isParty) {
      res.status(403).json({ error: 'Access denied. You are not a party in this case.' });
      return;
    }

    res.json({ case: caseDoc });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to fetch case' });
  }
});

// PATCH /api/cases/:id/status
router.patch('/:id/status', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { status } = req.body;
  const user = req.user!;

  const validStatuses = ['draft', 'unassigned', 'pending', 'active', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }

  try {
    const caseDoc = await Case.findByIdAndUpdate(
      req.params.id,
      { status, lastActivityAt: new Date() },
      { new: true }
    );

    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    await auditLogger({
      action: 'CASE_STATUS_CHANGED',
      performedBy: user._id,
      performedByRole: user.role,
      targetEntity: 'case',
      targetId: caseDoc._id.toString(),
      metadata: { newStatus: status, caseNumber: caseDoc.caseNumber },
      ipAddress: req.ip,
    });

    await firebaseNotify({
      caseId: caseDoc._id.toString(),
      title: 'Case Update',
      body: `Case ${caseDoc.caseNumber} status changed to ${status}`,
      userIds: [caseDoc.citizenId, caseDoc.lawyerId, caseDoc.judgeId].filter(
        Boolean
      ) as mongoose.Types.ObjectId[],
    });

    res.json({ case: caseDoc });
  } catch (error) {
    console.error('Update case status error:', error);
    res.status(500).json({ error: 'Failed to update case status' });
  }
});

// POST /api/cases/:id/grievance
router.post('/:id/grievance', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { message } = req.body;
  const user = req.user!;

  if (!message) {
    res.status(400).json({ error: 'Grievance message is required' });
    return;
  }

  try {
    const caseDoc = await Case.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          grievances: {
            raisedBy: user._id,
            message,
            createdAt: new Date(),
            resolved: false,
          },
        },
        lastActivityAt: new Date(),
      },
      { new: true }
    );

    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    if (caseDoc.judgeId) {
      await firebaseNotify({
        caseId: caseDoc._id.toString(),
        title: 'New Grievance Filed',
        body: `A grievance has been raised on case ${caseDoc.caseNumber}`,
        userIds: [caseDoc.judgeId],
      });
    }

    res.status(201).json({ message: 'Grievance submitted successfully' });
  } catch (error) {
    console.error('Submit grievance error:', error);
    res.status(500).json({ error: 'Failed to submit grievance' });
  }
});

// PATCH /api/cases/:id/assign
router.patch('/:id/assign', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { judgeId, lawyerId } = req.body;
  const user = req.user!;

  if (!['judge', 'admin'].includes(user.role)) {
    res.status(403).json({ error: 'Only judges or admins can assign cases' });
    return;
  }

  try {
    const updates: Record<string, unknown> = { lastActivityAt: new Date() };
    if (judgeId) updates.judgeId = judgeId;
    if (lawyerId) updates.lawyerId = lawyerId;

    const caseDoc = await Case.findByIdAndUpdate(req.params.id, updates, { new: true });

    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }

    res.json({ case: caseDoc });
  } catch (error) {
    console.error('Assign case error:', error);
    res.status(500).json({ error: 'Failed to assign case' });
  }
});

export default router;
