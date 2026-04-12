"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = __importDefault(require("../models/User"));
const LawyerProfile_1 = __importDefault(require("../models/LawyerProfile"));
const auth_1 = require("../middleware/auth");
const generateUID_1 = require("../utils/generateUID");
const auditLogger_1 = require("../utils/auditLogger");
const RegistrationRequest_1 = __importDefault(require("../models/RegistrationRequest"));
const firebase_1 = require("../config/firebase");
const router = (0, express_1.Router)();
// POST /api/auth/register
// Creates a new user in MongoDB after Firebase sign-in
router.post('/register', async (req, res) => {
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
        const existing = await User_1.default.findOne({ firebaseUid });
        if (existing) {
            if (existing.role !== role) {
                existing.role = role;
                await existing.save();
            }
            if (role === 'lawyer') {
                const profileExists = await LawyerProfile_1.default.findOne({ userId: existing._id });
                if (!profileExists) {
                    await LawyerProfile_1.default.create({
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
        const systemUid = await (0, generateUID_1.generateSystemUID)(role);
        const user = await User_1.default.create({
            firebaseUid,
            email,
            role,
            systemUid,
            profile: { name, phone, courtId, photoURL },
            isVerified: false,
        });
        if (role === 'lawyer') {
            await LawyerProfile_1.default.create({
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
        await (0, auditLogger_1.auditLogger)({
            action: 'USER_REGISTERED',
            performedBy: user._id,
            performedByRole: role,
            targetEntity: 'user',
            targetId: user._id.toString(),
            metadata: { systemUid, role, email },
        });
        res.status(201).json({ user, message: 'Registration successful' });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ error: 'User with this email or UID already exists' });
        }
        else {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});
// POST /api/auth/professional/apply
// Creates a pending request in MongoDB and disables the newly created Firebase User
router.post('/professional/apply', async (req, res) => {
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
        await firebase_1.admin.auth().updateUser(firebaseUid, { disabled: true });
        // 2. Create pending request
        await RegistrationRequest_1.default.create({
            firebaseUid,
            name,
            email,
            role,
            licenseNumber,
            mobile,
            status: 'pending'
        });
        res.status(201).json({ message: 'Request submitted successfully. Pending Admin approval.' });
    }
    catch (error) {
        console.error('Professional Apply Error:', error);
        res.status(500).json({ error: 'Failed to submit application. Please try again.' });
    }
});
// GET /api/auth/me
router.get('/me', auth_1.authenticate, async (req, res) => {
    res.json({ user: req.user });
});
// PATCH /api/auth/fcm-token
router.patch('/fcm-token', auth_1.authenticate, async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken) {
        res.status(400).json({ error: 'fcmToken is required' });
        return;
    }
    await User_1.default.findByIdAndUpdate(req.user._id, { fcmToken });
    res.json({ message: 'FCM token updated' });
});
exports.default = router;
