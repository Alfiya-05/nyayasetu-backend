import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import LawyerProfile from '../models/LawyerProfile';

const router = Router();

const DEMO_LAWYERS = [
  {
    name: 'Adv. Priya Sharma',
    email: 'priya.sharma.demo@nyayasetu.in',
    location: 'New Delhi',
    post: 'Senior Advocate – Supreme Court of India',
    specialisations: ['Criminal Law', 'Constitutional Law', 'Cyber Crime'],
    experienceYears: 18,
    barNumber: 'D/2006/00142',
    feePerHearing: 25000,
    retainerFee: 150000,
    rating: 4.9,
    totalCases: 312,
    bio: 'Former Additional Solicitor General with expertise in high-profile criminal and constitutional matters. Argued landmark cases before the Supreme Court.',
  },
  {
    name: 'Adv. Rahul Mehta',
    email: 'rahul.mehta.demo@nyayasetu.in',
    location: 'Mumbai',
    post: 'Advocate – Bombay High Court',
    specialisations: ['Corporate Law', 'Banking & Finance', 'Insolvency'],
    experienceYears: 12,
    barNumber: 'M/2012/00789',
    feePerHearing: 18000,
    retainerFee: 100000,
    rating: 4.7,
    totalCases: 245,
    bio: 'Specialises in corporate restructuring and NCLT proceedings. Represented Fortune 500 companies in insolvency matters.',
  },
  {
    name: 'Adv. Sunita Rao',
    email: 'sunita.rao.demo@nyayasetu.in',
    location: 'Bangalore',
    post: 'Advocate – Karnataka High Court',
    specialisations: ['Family Law', 'Women & Child Rights', 'Civil Disputes'],
    experienceYears: 9,
    barNumber: 'B/2015/00334',
    feePerHearing: 10000,
    retainerFee: 60000,
    rating: 4.8,
    totalCases: 178,
    bio: 'Passionate about women\'s rights and child custody disputes. Known for empathetic client handling and swift settlements.',
  },
  {
    name: 'Adv. Mohammed Azhar',
    email: 'azhar.demo@nyayasetu.in',
    location: 'Hyderabad',
    post: 'Junior Advocate – Telangana High Court',
    specialisations: ['Property Law', 'Revenue Disputes', 'Land Acquisition'],
    experienceYears: 5,
    barNumber: 'H/2019/01102',
    feePerHearing: 6000,
    retainerFee: 35000,
    rating: 4.5,
    totalCases: 89,
    bio: 'Rising advocate specialising in property and land dispute matters with a strong track record in Telangana revenue courts.',
  },
  {
    name: 'Adv. Kavita Nair',
    email: 'kavita.nair.demo@nyayasetu.in',
    location: 'Chennai',
    post: 'Advocate – Madras High Court',
    specialisations: ['Labour Law', 'Employment Disputes', 'Industrial Relations'],
    experienceYears: 14,
    barNumber: 'C/2010/00561',
    feePerHearing: 14000,
    retainerFee: 85000,
    rating: 4.6,
    totalCases: 203,
    bio: 'Expert in labour tribunal proceedings and employment discrimination. Regularly consulted by leading corporates on HR policy compliance.',
  },
  {
    name: 'Adv. Arjun Khanna',
    email: 'arjun.khanna.demo@nyayasetu.in',
    location: 'Kolkata',
    post: 'Advocate – Calcutta High Court',
    specialisations: ['Tax Law', 'GST Disputes', 'Income Tax Appeals'],
    experienceYears: 10,
    barNumber: 'K/2014/00283',
    feePerHearing: 12000,
    retainerFee: 70000,
    rating: 4.4,
    totalCases: 156,
    bio: 'Former IRS officer turned advocate. Handles complex income tax and GST appellate proceedings before ITAT and High Courts.',
  },
];

// POST /api/seed/lawyers — seed demo lawyers (dev only)
router.post('/lawyers', async (_req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Seeding is not allowed in production' });
    return;
  }

  try {
    let inserted = 0;
    let skipped = 0;

    for (const data of DEMO_LAWYERS) {
      const existing = await User.findOne({ email: data.email });
      if (existing) { skipped++; continue; }

      // Create a fake ObjectId-based firebaseUid for demo users
      const fakeUid = `demo_${new mongoose.Types.ObjectId().toHexString()}`;

      const user = await User.create({
        firebaseUid: fakeUid,
        email: data.email,
        role: 'lawyer',
        systemUid: `LAW-DEMO-${String(inserted + 1).padStart(3, '0')}`,
        profile: {
          name: data.name,
          location: data.location,
          photoURL: null,
        },
        isVerified: true,
      });

      await LawyerProfile.create({
        userId: user._id,
        barNumber: data.barNumber,
        specialisations: data.specialisations,
        courtIds: [],
        experienceYears: data.experienceYears,
        feePerHearing: data.feePerHearing,
        retainerFee: data.retainerFee,
        rating: data.rating,
        totalCases: data.totalCases,
        isAvailable: true,
        isBarVerified: true,
        bio: data.bio,
        post: data.post,
      });

      inserted++;
    }

    res.json({ message: `Seeded ${inserted} demo lawyers. Skipped ${skipped} existing.` });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Seeding failed', details: String(error) });
  }
});

// DELETE /api/seed/lawyers — clear demo lawyers
router.delete('/lawyers', async (_req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ error: 'Not allowed in production' });
    return;
  }
  const demoEmails = DEMO_LAWYERS.map(l => l.email);
  const users = await User.find({ email: { $in: demoEmails } });
  const userIds = users.map(u => u._id);
  await LawyerProfile.deleteMany({ userId: { $in: userIds } });
  await User.deleteMany({ email: { $in: demoEmails } });
  res.json({ message: `Cleared ${users.length} demo lawyers` });
});

export default router;
