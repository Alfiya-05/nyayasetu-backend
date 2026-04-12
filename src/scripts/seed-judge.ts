/**
 * seed-judge.ts — Creates the specific judge user in Firebase + MongoDB
 * Usage: npx ts-node src/scripts/seed-judge.ts
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

const JUDGE_EMAIL = 'aayamparkar096@gmail.com';
const JUDGE_NAME = 'Judge Aayam Parkar';
const JUDGE_PASSWORD = 'Judge@123';

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('MongoDB connected');

  // ------ Firebase ------
  let firebaseUid: string;
  try {
    const existing = await adminSdk.auth().getUserByEmail(JUDGE_EMAIL);
    firebaseUid = existing.uid;
    await adminSdk.auth().updateUser(firebaseUid, { disabled: false, password: JUDGE_PASSWORD });
    console.log(`Firebase user already existed. UID: ${firebaseUid}. Re-enabled & password reset.`);
  } catch (e: any) {
    if (e.code === 'auth/user-not-found') {
      const created = await adminSdk.auth().createUser({
        email: JUDGE_EMAIL,
        password: JUDGE_PASSWORD,
        displayName: JUDGE_NAME,
        disabled: false,
      });
      firebaseUid = created.uid;
      console.log(`Firebase Judge user CREATED. UID: ${firebaseUid}`);
    } else {
      throw e;
    }
  }

  // ------ MongoDB ------
  const CounterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
  const Counter = mongoose.models['Counter'] || mongoose.model('Counter', CounterSchema);
  const counter = await (Counter as any).findByIdAndUpdate('uid_judge_2026', { $inc: { seq: 1 } }, { new: true, upsert: true });
  const systemUid = `JUD-2026-${String(counter.seq).padStart(5, '0')}`;

  const UserModel = mongoose.model('User', new mongoose.Schema({}, { strict: false, timestamps: true }));
  const existing = await UserModel.findOne({ email: JUDGE_EMAIL });

  if (existing) {
    await UserModel.updateOne({ email: JUDGE_EMAIL }, { $set: { firebaseUid, isVerified: true, role: 'judge' } });
    console.log('MongoDB judge user updated (already existed).');
  } else {
    await UserModel.create({
      firebaseUid,
      email: JUDGE_EMAIL,
      role: 'judge',
      systemUid,
      profile: { name: JUDGE_NAME },
      isVerified: true,
    });
    console.log('MongoDB judge user CREATED.');
  }

  console.log('\n✅ Judge seeding complete!');
  console.log(`   Name    : ${JUDGE_NAME}`);
  console.log(`   Email   : ${JUDGE_EMAIL}`);
  console.log(`   Password: ${JUDGE_PASSWORD}`);
  console.log(`   Firebase UID: ${firebaseUid}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
