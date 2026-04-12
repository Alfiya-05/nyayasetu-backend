"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * seed-judge.ts — Creates the specific judge user in Firebase + MongoDB
 * Usage: npx ts-node src/scripts/seed-judge.ts
 */
require("dotenv/config");
const mongoose_1 = __importDefault(require("mongoose"));
const adminSdk = __importStar(require("firebase-admin"));
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
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    // ------ Firebase ------
    let firebaseUid;
    try {
        const existing = await adminSdk.auth().getUserByEmail(JUDGE_EMAIL);
        firebaseUid = existing.uid;
        await adminSdk.auth().updateUser(firebaseUid, { disabled: false, password: JUDGE_PASSWORD });
        console.log(`Firebase user already existed. UID: ${firebaseUid}. Re-enabled & password reset.`);
    }
    catch (e) {
        if (e.code === 'auth/user-not-found') {
            const created = await adminSdk.auth().createUser({
                email: JUDGE_EMAIL,
                password: JUDGE_PASSWORD,
                displayName: JUDGE_NAME,
                disabled: false,
            });
            firebaseUid = created.uid;
            console.log(`Firebase Judge user CREATED. UID: ${firebaseUid}`);
        }
        else {
            throw e;
        }
    }
    // ------ MongoDB ------
    const CounterSchema = new mongoose_1.default.Schema({ _id: String, seq: { type: Number, default: 0 } });
    const Counter = mongoose_1.default.models['Counter'] || mongoose_1.default.model('Counter', CounterSchema);
    const counter = await Counter.findByIdAndUpdate('uid_judge_2026', { $inc: { seq: 1 } }, { new: true, upsert: true });
    const systemUid = `JUD-2026-${String(counter.seq).padStart(5, '0')}`;
    const UserModel = mongoose_1.default.model('User', new mongoose_1.default.Schema({}, { strict: false, timestamps: true }));
    const existing = await UserModel.findOne({ email: JUDGE_EMAIL });
    if (existing) {
        await UserModel.updateOne({ email: JUDGE_EMAIL }, { $set: { firebaseUid, isVerified: true, role: 'judge' } });
        console.log('MongoDB judge user updated (already existed).');
    }
    else {
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
