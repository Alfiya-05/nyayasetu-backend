/**
 * seed-admin.ts — Run once to create the admin Firebase + MongoDB user
 * Usage: npx ts-node src/scripts/seed-admin.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as adminSdk from 'firebase-admin';

const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!adminSdk.apps.length) {
  adminSdk.initializeApp({
    credential: adminSdk.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const ADMIN_EMAIL = 'nyaysetu.hackwarts@gmail.com';
const ADMIN_PASSWORD = 'India!@11';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('MongoDB connected');

  // ------ Firebase ------
  let firebaseUid: string;
  try {
    const existing = await adminSdk.auth().getUserByEmail(ADMIN_EMAIL);
    firebaseUid = existing.uid;
    // Ensure the user is enabled and password is correct
    await adminSdk.auth().updateUser(firebaseUid, {
      password: ADMIN_PASSWORD,
      disabled: false,
    });
    console.log(`Firebase user already existed. UID: ${firebaseUid}. Password reset & enabled.`);
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      const created = await adminSdk.auth().createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        displayName: 'NyayaSetu Admin',
        disabled: false,
      });
      firebaseUid = created.uid;
      console.log(`Firebase Admin user CREATED. UID: ${firebaseUid}`);
    } else {
      throw e;
    }
  }

  // ------ MongoDB ------
  const UserModel = mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }));

  const existing = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    console.log('MongoDB admin user already exists. Ensuring firebaseUid is synced...');
    await UserModel.updateOne({ email: ADMIN_EMAIL }, { $set: { firebaseUid, isVerified: true, role: 'admin' } });
    console.log('MongoDB admin user updated.');
  } else {
    await UserModel.create({
      firebaseUid,
      email: ADMIN_EMAIL,
      role: 'admin',
      systemUid: 'ADM-HACKWARTS-001',
      profile: { name: 'NyayaSetu Admin' },
      isVerified: true,
    });
    console.log('MongoDB admin user CREATED.');
  }

  console.log('\n✅ Admin seeding complete!');
  console.log(`   Email   : ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
  console.log(`   Firebase UID: ${firebaseUid}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
