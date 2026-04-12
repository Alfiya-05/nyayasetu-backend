"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = __importDefault(require("../models/User"));
const Case_1 = __importDefault(require("../models/Case"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
const auth_1 = require("../middleware/auth");
const roleGuard_1 = require("../middleware/roleGuard");
const auditLogger_1 = require("../utils/auditLogger");
const RegistrationRequest_1 = __importDefault(require("../models/RegistrationRequest"));
const LawyerProfile_1 = __importDefault(require("../models/LawyerProfile"));
const firebase_1 = require("../config/firebase");
const generateUID_1 = require("../utils/generateUID");
const router = (0, express_1.Router)();
// All admin routes require admin role
router.use(auth_1.authenticate, (0, roleGuard_1.roleGuard)(['admin']));
// GET /api/admin/users
router.get('/users', async (_req, res) => {
    try {
        const users = await User_1.default.find().sort({ createdAt: -1 });
        res.json({ users });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});
// GET /api/admin/requests
router.get('/requests', async (_req, res) => {
    try {
        const requests = await RegistrationRequest_1.default.find().sort({ createdAt: -1 });
        res.json({ requests });
    }
    catch (error) {
        console.error('Fetch requests error:', error);
        res.status(500).json({ error: 'Failed to fetch registration requests' });
    }
});
// POST /api/admin/requests/:id/approve
router.post('/requests/:id/approve', async (req, res) => {
    const adminUser = req.user;
    try {
        const request = await RegistrationRequest_1.default.findById(req.params.id);
        if (!request || request.status !== 'pending') {
            res.status(404).json({ error: 'Request not found or not pending' });
            return;
        }
        // 1. Enable Firebase User via initialized app
        const firebaseApp = (0, firebase_1.initFirebaseAdmin)();
        await firebaseApp.auth().updateUser(request.firebaseUid, { disabled: false });
        // 2. Upsert MongoDB User (handles case where stale user doc already exists)
        let newUser = await User_1.default.findOne({ firebaseUid: request.firebaseUid });
        if (newUser) {
            // Update existing stale user to correct role and mark verified
            newUser.role = request.role;
            newUser.isVerified = true;
            newUser.profile.name = request.name;
            await newUser.save();
        }
        else {
            const systemUid = await (0, generateUID_1.generateSystemUID)(request.role);
            newUser = await User_1.default.create({
                firebaseUid: request.firebaseUid,
                email: request.email,
                role: request.role,
                systemUid,
                profile: { name: request.name },
                isVerified: true
            });
        }
        // 3. Create Lawyer Profile if role is lawyer and one doesn't exist yet
        if (request.role === 'lawyer') {
            const existingProfile = await LawyerProfile_1.default.findOne({ userId: newUser._id });
            if (!existingProfile) {
                await LawyerProfile_1.default.create({
                    userId: newUser._id,
                    barNumber: request.licenseNumber,
                    specialisations: ['General Practice'],
                    experienceYears: 0,
                    feePerHearing: 5000,
                    isAvailable: true,
                    isBarVerified: true,
                    bio: 'Newly registered advocate.',
                });
            }
        }
        // 4. Update request status
        request.status = 'approved';
        await request.save();
        await (0, auditLogger_1.auditLogger)({
            action: 'PROFESSIONAL_APPROVED',
            performedBy: adminUser._id,
            performedByRole: adminUser.role,
            targetEntity: 'user',
            targetId: newUser._id.toString(),
            metadata: { email: newUser.email, role: newUser.role },
            ipAddress: req.ip,
        });
        res.json({ message: 'Request approved successfully', user: newUser });
    }
    catch (error) {
        console.error('Approve request error:', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
});
// POST /api/admin/requests/:id/reject
router.post('/requests/:id/reject', async (req, res) => {
    try {
        const request = await RegistrationRequest_1.default.findById(req.params.id);
        if (!request || request.status !== 'pending') {
            res.status(404).json({ error: 'Request not found or not pending' });
            return;
        }
        // Attempt to delete the disabled user from Firebase
        try {
            await firebase_1.admin.auth().deleteUser(request.firebaseUid);
        }
        catch (e) {
            console.log('Firebase user might already be deleted', e);
        }
        request.status = 'rejected';
        await request.save();
        res.json({ message: 'Request rejected and removed' });
    }
    catch (error) {
        console.error('Reject request error:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
});
// PATCH /api/admin/users/:id/role
router.patch('/users/:id/role', async (req, res) => {
    const { role } = req.body;
    const admin = req.user;
    const validRoles = ['citizen', 'lawyer', 'judge', 'admin'];
    if (!validRoles.includes(role)) {
        res.status(400).json({ error: 'Invalid role' });
        return;
    }
    try {
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { role }, { new: true });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await (0, auditLogger_1.auditLogger)({
            action: 'USER_ROLE_CHANGED',
            performedBy: admin._id,
            performedByRole: admin.role,
            targetEntity: 'user',
            targetId: req.params.id,
            metadata: { newRole: role, email: user.email },
            ipAddress: req.ip,
        });
        res.json({ user });
    }
    catch (error) {
        console.error('Change role error:', error);
        res.status(500).json({ error: 'Failed to change user role' });
    }
});
// PATCH /api/admin/users/:id/verify
router.patch('/users/:id/verify', async (req, res) => {
    const admin = req.user;
    try {
        const user = await User_1.default.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        await (0, auditLogger_1.auditLogger)({
            action: 'USER_VERIFIED',
            performedBy: admin._id,
            performedByRole: admin.role,
            targetEntity: 'user',
            targetId: req.params.id,
            metadata: { email: user.email, role: user.role },
            ipAddress: req.ip,
        });
        res.json({ user, message: 'User verified successfully' });
    }
    catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({ error: 'Failed to verify user' });
    }
});
// GET /api/admin/audit — paginated audit log
router.get('/audit', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    try {
        const [logs, total] = await Promise.all([
            AuditLog_1.default.find()
                .populate('performedBy', 'profile.name email systemUid')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit),
            AuditLog_1.default.countDocuments(),
        ]);
        res.json({ logs, total, page, pages: Math.ceil(total / limit) });
    }
    catch (error) {
        console.error('Audit log error:', error);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});
// GET /api/admin/stats
router.get('/stats', async (_req, res) => {
    try {
        const [totalUsers, totalCases, activeCases, pendingCases] = await Promise.all([
            User_1.default.countDocuments(),
            Case_1.default.countDocuments(),
            Case_1.default.countDocuments({ status: 'active' }),
            Case_1.default.countDocuments({ status: 'pending' }),
        ]);
        const usersByRole = await User_1.default.aggregate([
            { $group: { _id: '$role', count: { $sum: 1 } } },
        ]);
        res.json({
            stats: {
                totalUsers,
                totalCases,
                activeCases,
                pendingCases,
                usersByRole: Object.fromEntries(usersByRole.map((r) => [r._id, r.count])),
                timestamp: new Date(),
            },
        });
    }
    catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});
exports.default = router;
