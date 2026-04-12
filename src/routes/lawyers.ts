import { Router, Response } from 'express';
import User from '../models/User';
import LawyerProfile from '../models/LawyerProfile';
import Case from '../models/Case';
import { authenticate, AuthRequest } from '../middleware/auth';
import { firebaseNotify } from '../utils/firebaseNotify';
import mongoose from 'mongoose';

const router = Router();

// GET /api/lawyers — marketplace listing
router.get('/', authenticate, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = process.env.NODE_ENV === 'production'
      ? { isAvailable: true, isBarVerified: true }
      : { isAvailable: true }; // show demo lawyers in dev

    const profiles = await LawyerProfile.find(filter)
      .populate('userId', 'profile email systemUid firebaseUid')
      .sort({ rating: -1 });

    // Filter out mock/demo lawyers created by seed
    const registeredLawyers = profiles.filter((p) => {
      const u = p.userId as any;
      if (!u) return false;
      if (u.firebaseUid && typeof u.firebaseUid === 'string' && u.firebaseUid.startsWith('demo_')) {
        return false;
      }
      return true;
    });

    res.json({ lawyers: registeredLawyers });
  } catch (error) {
    console.error('Get lawyers error:', error);
    res.status(500).json({ error: 'Failed to fetch lawyers' });
  }
});

// GET /api/lawyers/:id
router.get('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await LawyerProfile.findOne({ userId: req.params.id }).populate(
      'userId',
      'profile email systemUid'
    );

    if (!profile) {
      res.status(404).json({ error: 'Lawyer profile not found' });
      return;
    }

    res.json({ lawyer: profile });
  } catch (error) {
    console.error('Get lawyer error:', error);
    res.status(500).json({ error: 'Failed to fetch lawyer' });
  }
});

// POST /api/lawyers/request — citizen sends case request to lawyer
router.post('/request', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { lawyerId, caseId } = req.body;
  const user = req.user!;

  if (!lawyerId || !caseId) {
    res.status(400).json({ error: 'lawyerId and caseId are required' });
    return;
  }

  try {
    const lawyer = await User.findById(lawyerId);
    if (!lawyer || lawyer.role !== 'lawyer') {
      res.status(404).json({ error: 'Lawyer not found' });
      return;
    }

    const caseDoc = await Case.findOneAndUpdate(
      { _id: caseId, citizenId: user._id },
      { lawyerId: lawyer._id, status: 'unassigned', lastActivityAt: new Date() },
      { new: true }
    );
    if (!caseDoc) {
      res.status(404).json({ error: 'Case not found or access denied' });
      return;
    }

    // Notify lawyer of new case request
    await firebaseNotify({
      caseId,
      title: 'New Case Request',
      body: `${user.profile.name} has requested your services for case ${caseDoc.caseNumber}`,
      userIds: [new mongoose.Types.ObjectId(lawyerId)],
      data: { type: 'case_request', citizenId: user._id.toString() },
    });

    res.json({ message: 'Request sent to lawyer successfully' });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ error: 'Failed to send request' });
  }
});

// POST /api/lawyers/request/:caseId/respond — lawyer accepts/declines
router.post(
  '/request/:caseId/respond',
  authenticate,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { action, message } = req.body; // action: 'accept' | 'decline'
    const user = req.user!;

    if (!['accept', 'decline'].includes(action)) {
      res.status(400).json({ error: "action must be 'accept' or 'decline'" });
      return;
    }

    if (user.role !== 'lawyer') {
      res.status(403).json({ error: 'Only lawyers can respond to case requests' });
      return;
    }

    try {
      const caseDoc = await Case.findById(req.params.caseId);
      if (!caseDoc) {
        res.status(404).json({ error: 'Case not found' });
        return;
      }

      if (action === 'accept') {
        // Always assign to the designated presiding judge
        const DESIGNATED_JUDGE_EMAIL = 'aayamparkar096@gmail.com';
        const designatedJudge = await User.findOne({ email: DESIGNATED_JUDGE_EMAIL, role: 'judge' });

        await Case.findByIdAndUpdate(req.params.caseId, {
          lawyerId: user._id,
          ...(designatedJudge ? { judgeId: designatedJudge._id } : {}),
          status: 'active',
          lastActivityAt: new Date(),
        });
      } else {
        await Case.findByIdAndUpdate(req.params.caseId, {
          $unset: { lawyerId: "" },
          status: 'unassigned',
          lastActivityAt: new Date(),
        });
      }

      // Notify citizen
      await firebaseNotify({
        caseId: req.params.caseId,
        title: action === 'accept' ? 'Lawyer Accepted Your Case' : 'Lawyer Declined Your Request',
        body:
          action === 'accept'
            ? `${user.profile.name} has accepted your case request.`
            : message || `${user.profile.name} has declined your request.`,
        userIds: [caseDoc.citizenId],
        data: { type: `lawyer_${action}` },
      });

      res.json({ message: `Request ${action}ed successfully` });
    } catch (error) {
      console.error('Respond to request error:', error);
      res.status(500).json({ error: 'Failed to respond to request' });
    }
  }
);

// POST /api/lawyers/profile — create/update lawyer profile
router.post('/profile', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = req.user!;
  if (user.role !== 'lawyer') {
    res.status(403).json({ error: 'Only lawyers can create a profile' });
    return;
  }

  const { barNumber, specialisations, courtIds, experienceYears, feePerHearing, retainerFee, bio } =
    req.body;

  try {
    const profile = await LawyerProfile.findOneAndUpdate(
      { userId: user._id },
      { barNumber, specialisations, courtIds, experienceYears, feePerHearing, retainerFee, bio },
      { upsert: true, new: true }
    );

    res.json({ profile });
  } catch (error) {
    console.error('Create lawyer profile error:', error);
    res.status(500).json({ error: 'Failed to create/update lawyer profile' });
  }
});

export default router;
