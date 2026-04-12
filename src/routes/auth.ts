import { Router, Request, Response } from 'express';
import User from '../models/User';
import LawyerProfile from '../models/LawyerProfile';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateSystemUID } from '../utils/generateUID';
import { auditLogger } from '../utils/auditLogger';
import RegistrationRequest from '../models/RegistrationRequest';
import { admin } from '../config/firebase';

const router = Router();

// POST /api/auth/register
// Creates a new user in MongoDB after Firebase sign-in
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { firebaseUid, email, role, name, phone, courtId, photoURL } = req.body;

  if (!firebaseUid || !email || !role || !name) {
    res.status(400).json({ error: 'firebaseUid, email, role, and name are required' });
    return;
  }

  const validRoles = ['citizen', 'lawyer', 'judge', 'admin'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    return;
  }

  try {
    // Check if user already exists
    const existing = await User.findOne({ firebaseUid });
    if (existing) {
      if (existing.role !== role) {
        existing.role = role;
        await existing.save();
      }
      if (role === 'lawyer') {
        const profileExists = await LawyerProfile.findOne({ userId: existing._id });
        if (!profileExists) {
          await LawyerProfile.create({
            userId: existing._id,
            barNumber: `DEMO-${Math.floor(Math.random() * 10000)}`,
            specialisations: ['General Practice'],
            experienceYears: 5,
            feePerHearing: 5000,
            isAvailable: true,
            isBarVerified: true,
            bio: 'Self-registered lawyer for testing purposes.',
          });
        }
      }
      res.status(200).json({ user: existing, message: 'User logged in' });
      return;
    }

    const systemUid = await generateSystemUID(role);

    const user = await User.create({
      firebaseUid,
      email,
      role,
      systemUid,
      profile: { name, phone, courtId, photoURL },
      isVerified: false,
    });

    if (role === 'lawyer') {
      await LawyerProfile.create({
        userId: user._id,
        barNumber: `DEMO-${Math.floor(Math.random() * 10000)}`,
        specialisations: ['General Practice'],
        experienceYears: 5,
        feePerHearing: 5000,
        isAvailable: true,
        isBarVerified: true,
        bio: 'Self-registered lawyer for testing purposes.',
      });
    }

    await auditLogger({
      action: 'USER_REGISTERED',
      performedBy: user._id,
      performedByRole: role,
      targetEntity: 'user',
      targetId: user._id.toString(),
      metadata: { systemUid, role, email },
    });

    res.status(201).json({ user, message: 'Registration successful' });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      res.status(409).json({ error: 'User with this email or UID already exists' });
    } else {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
});

// POST /api/auth/professional/apply
// Creates a pending request in MongoDB and disables the newly created Firebase User
router.post('/professional/apply', async (req: Request, res: Response): Promise<void> => {
  const { firebaseUid, email, role, name, licenseNumber, mobile } = req.body;

  if (!firebaseUid || !email || !role || !name || !licenseNumber || !mobile) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  const validRoles = ['lawyer', 'judge'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Role must be lawyer or judge' });
    return;
  }

  try {
    // 1. Mark firebase user as disabled
    await admin.auth().updateUser(firebaseUid, { disabled: true });

    // 2. Create pending request
    await RegistrationRequest.create({
      firebaseUid,
      name,
      email,
      role,
      licenseNumber,
      mobile,
      status: 'pending'
    });

    res.status(201).json({ message: 'Request submitted successfully. Pending Admin approval.' });
  } catch (error) {
    console.error('Professional Apply Error:', error);
    res.status(500).json({ error: 'Failed to submit application. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
});

// PATCH /api/auth/fcm-token
router.patch('/fcm-token', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { fcmToken } = req.body;
  if (!fcmToken) {
    res.status(400).json({ error: 'fcmToken is required' });
    return;
  }
  await User.findByIdAndUpdate(req.user!._id, { fcmToken });
  res.json({ message: 'FCM token updated' });
});

export default router;
