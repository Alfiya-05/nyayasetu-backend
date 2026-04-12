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
 * seed-admin.ts — Run once to create the admin Firebase + MongoDB user
 * Usage: npx ts-node src/scripts/seed-admin.ts
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
const ADMIN_EMAIL = 'nyaysetu.hackwarts@gmail.com';
const ADMIN_PASSWORD = 'India!@11';
async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose_1.default.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
    // ------ Firebase ------
    let firebaseUid;
    try {
        const existing = await adminSdk.auth().getUserByEmail(ADMIN_EMAIL);
        firebaseUid = existing.uid;
        // Ensure the user is enabled and password is correct
        await adminSdk.auth().updateUser(firebaseUid, {
            password: ADMIN_PASSWORD,
            disabled: false,
        });
        console.log(`Firebase user already existed. UID: ${firebaseUid}. Password reset & enabled.`);
    }
    catch (e) {
        if (e.code === 'auth/user-not-found') {
            const created = await adminSdk.auth().createUser({
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                displayName: 'NyayaSetu Admin',
                disabled: false,
            });
            firebaseUid = created.uid;
            console.log(`Firebase Admin user CREATED. UID: ${firebaseUid}`);
        }
        else {
            throw e;
        }
    }
    // ------ MongoDB ------
    const UserModel = mongoose_1.default.model('User', new mongoose_1.default.Schema({}, { strict: false, timestamps: true }));
    const existing = await UserModel.findOne({ email: ADMIN_EMAIL });
    if (existing) {
        console.log('MongoDB admin user already exists. Ensuring firebaseUid is synced...');
        await UserModel.updateOne({ email: ADMIN_EMAIL }, { $set: { firebaseUid, isVerified: true, role: 'admin' } });
        console.log('MongoDB admin user updated.');
    }
    else {
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
