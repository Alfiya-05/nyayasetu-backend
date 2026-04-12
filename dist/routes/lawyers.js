"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const User_1 = __importDefault(require("../models/User"));
const LawyerProfile_1 = __importDefault(require("../models/LawyerProfile"));
const Case_1 = __importDefault(require("../models/Case"));
const auth_1 = require("../middleware/auth");
const firebaseNotify_1 = require("../utils/firebaseNotify");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// GET /api/lawyers — marketplace listing
router.get('/', auth_1.authenticate, async (_req, res) => {
    try {
        const filter = process.env.NODE_ENV === 'production'
            ? { isAvailable: true, isBarVerified: true }
            : { isAvailable: true }; // show demo lawyers in dev
        const profiles = await LawyerProfile_1.default.find(filter)
            .populate('userId', 'profile email systemUid firebaseUid')
            .sort({ rating: -1 });
        // Filter out mock/demo lawyers created by seed
        const registeredLawyers = profiles.filter((p) => {
            const u = p.userId;
            if (!u)
                return false;
            if (u.firebaseUid && typeof u.firebaseUid === 'string' && u.firebaseUid.startsWith('demo_')) {
                return false;
            }
            return true;
        });
        res.json({ lawyers: registeredLawyers });
    }
    catch (error) {
        console.error('Get lawyers error:', error);
        res.status(500).json({ error: 'Failed to fetch lawyers' });
    }
});
// GET /api/lawyers/:id
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const profile = await LawyerProfile_1.default.findOne({ userId: req.params.id }).populate('userId', 'profile email systemUid');
        if (!profile) {
            res.status(404).json({ error: 'Lawyer profile not found' });
            return;
        }
        res.json({ lawyer: profile });
    }
    catch (error) {
        console.error('Get lawyer error:', error);
        res.status(500).json({ error: 'Failed to fetch lawyer' });
    }
});
// POST /api/lawyers/request — citizen sends case request to lawyer
router.post('/request', auth_1.authenticate, async (req, res) => {
    const { lawyerId, caseId } = req.body;
    const user = req.user;
    if (!lawyerId || !caseId) {
        res.status(400).json({ error: 'lawyerId and caseId are required' });
        return;
    }
    try {
        const lawyer = await User_1.default.findById(lawyerId);
        if (!lawyer || lawyer.role !== 'lawyer') {
            res.status(404).json({ error: 'Lawyer not found' });
            return;
        }
        const caseDoc = await Case_1.default.findOneAndUpdate({ _id: caseId, citizenId: user._id }, { lawyerId: lawyer._id, status: 'unassigned', lastActivityAt: new Date() }, { new: true });
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found or access denied' });
            return;
        }
        // Notify lawyer of new case request
        await (0, firebaseNotify_1.firebaseNotify)({
            caseId,
            title: 'New Case Request',
            body: `${user.profile.name} has requested your services for case ${caseDoc.caseNumber}`,
            userIds: [new mongoose_1.default.Types.ObjectId(lawyerId)],
            data: { type: 'case_request', citizenId: user._id.toString() },
        });
        res.json({ message: 'Request sent to lawyer successfully' });
    }
    catch (error) {
        console.error('Send request error:', error);
        res.status(500).json({ error: 'Failed to send request' });
    }
});
// POST /api/lawyers/request/:caseId/respond — lawyer accepts/declines
router.post('/request/:caseId/respond', auth_1.authenticate, async (req, res) => {
    const { action, message } = req.body; // action: 'accept' | 'decline'
    const user = req.user;
    if (!['accept', 'decline'].includes(action)) {
        res.status(400).json({ error: "action must be 'accept' or 'decline'" });
        return;
    }
    if (user.role !== 'lawyer') {
        res.status(403).json({ error: 'Only lawyers can respond to case requests' });
        return;
    }
    try {
        const caseDoc = await Case_1.default.findById(req.params.caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        if (action === 'accept') {
            // Always assign to the designated presiding judge
            const DESIGNATED_JUDGE_EMAIL = 'aayamparkar096@gmail.com';
            const designatedJudge = await User_1.default.findOne({ email: DESIGNATED_JUDGE_EMAIL, role: 'judge' });
            await Case_1.default.findByIdAndUpdate(req.params.caseId, {
                lawyerId: user._id,
                ...(designatedJudge ? { judgeId: designatedJudge._id } : {}),
                status: 'active',
                lastActivityAt: new Date(),
            });
        }
        else {
            await Case_1.default.findByIdAndUpdate(req.params.caseId, {
                $unset: { lawyerId: "" },
                status: 'unassigned',
                lastActivityAt: new Date(),
            });
        }
        // Notify citizen
        await (0, firebaseNotify_1.firebaseNotify)({
            caseId: req.params.caseId,
            title: action === 'accept' ? 'Lawyer Accepted Your Case' : 'Lawyer Declined Your Request',
            body: action === 'accept'
                ? `${user.profile.name} has accepted your case request.`
                : message || `${user.profile.name} has declined your request.`,
            userIds: [caseDoc.citizenId],
            data: { type: `lawyer_${action}` },
        });
        res.json({ message: `Request ${action}ed successfully` });
    }
    catch (error) {
        console.error('Respond to request error:', error);
        res.status(500).json({ error: 'Failed to respond to request' });
    }
});
// POST /api/lawyers/profile — create/update lawyer profile
router.post('/profile', auth_1.authenticate, async (req, res) => {
    const user = req.user;
    if (user.role !== 'lawyer') {
        res.status(403).json({ error: 'Only lawyers can create a profile' });
        return;
    }
    const { barNumber, specialisations, courtIds, experienceYears, feePerHearing, retainerFee, bio } = req.body;
    try {
        const profile = await LawyerProfile_1.default.findOneAndUpdate({ userId: user._id }, { barNumber, specialisations, courtIds, experienceYears, feePerHearing, retainerFee, bio }, { upsert: true, new: true });
        res.json({ profile });
    }
    catch (error) {
        console.error('Create lawyer profile error:', error);
        res.status(500).json({ error: 'Failed to create/update lawyer profile' });
    }
});
exports.default = router;
