"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const Hearing_1 = __importDefault(require("../models/Hearing"));
const Case_1 = __importDefault(require("../models/Case"));
const auth_1 = require("../middleware/auth");
const roleGuard_1 = require("../middleware/roleGuard");
const auditLogger_1 = require("../utils/auditLogger");
const firebaseNotify_1 = require("../utils/firebaseNotify");
const router = (0, express_1.Router)();
// POST /api/hearings — judge creates a hearing
router.post('/', auth_1.authenticate, (0, roleGuard_1.roleGuard)(['judge']), async (req, res) => {
    const { caseId, hearingDate, courtRoom, notes } = req.body;
    const user = req.user;
    if (!caseId || !hearingDate) {
        res.status(400).json({ error: 'caseId and hearingDate are required' });
        return;
    }
    try {
        const caseDoc = await Case_1.default.findById(caseId);
        if (!caseDoc) {
            res.status(404).json({ error: 'Case not found' });
            return;
        }
        const hearing = await Hearing_1.default.create({
            caseId,
            judgeId: user._id,
            lawyerId: caseDoc.lawyerId,
            citizenId: caseDoc.citizenId,
            hearingDate: new Date(hearingDate),
            courtRoom,
            notes,
            status: 'scheduled',
        });
        // Add to case
        await Case_1.default.findByIdAndUpdate(caseId, {
            $push: { hearings: hearing._id },
            lastActivityAt: new Date(),
        });
        await (0, auditLogger_1.auditLogger)({
            action: 'HEARING_CREATED',
            performedBy: user._id,
            performedByRole: user.role,
            targetEntity: 'hearing',
            targetId: hearing._id.toString(),
            metadata: { caseId, hearingDate, courtRoom },
            ipAddress: req.ip,
        });
        const notifyIds = [caseDoc.lawyerId, caseDoc.citizenId].filter(Boolean);
        await (0, firebaseNotify_1.firebaseNotify)({
            caseId,
            title: 'Hearing Scheduled',
            body: `Hearing for case ${caseDoc.caseNumber} scheduled on ${new Date(hearingDate).toLocaleDateString('en-IN')} in ${courtRoom ?? 'TBD'}`,
            userIds: notifyIds,
        });
        res.status(201).json({ hearing });
    }
    catch (error) {
        console.error('Create hearing error:', error);
        res.status(500).json({ error: 'Failed to schedule hearing' });
    }
});
// PATCH /api/hearings/:id — judge updates hearing
router.patch('/:id', auth_1.authenticate, (0, roleGuard_1.roleGuard)(['judge']), async (req, res) => {
    const { hearingDate, courtRoom, status, notes } = req.body;
    const user = req.user;
    try {
        const updates = {};
        if (hearingDate)
            updates.hearingDate = new Date(hearingDate);
        if (courtRoom)
            updates.courtRoom = courtRoom;
        if (status)
            updates.status = status;
        if (notes !== undefined)
            updates.notes = notes;
        const hearing = await Hearing_1.default.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!hearing) {
            res.status(404).json({ error: 'Hearing not found' });
            return;
        }
        await (0, auditLogger_1.auditLogger)({
            action: 'HEARING_UPDATED',
            performedBy: user._id,
            performedByRole: user.role,
            targetEntity: 'hearing',
            targetId: hearing._id.toString(),
            metadata: updates,
            ipAddress: req.ip,
        });
        const caseDoc = await Case_1.default.findByIdAndUpdate(hearing.caseId, {
            lastActivityAt: new Date(),
        });
        if (caseDoc) {
            const notifyIds = [hearing.lawyerId, hearing.citizenId].filter(Boolean);
            await (0, firebaseNotify_1.firebaseNotify)({
                caseId: hearing.caseId.toString(),
                title: 'Hearing Updated',
                body: `Hearing for case ${caseDoc.caseNumber} has been updated${hearingDate ? ` to ${new Date(hearingDate).toLocaleDateString('en-IN')}` : ''}`,
                userIds: notifyIds,
            });
        }
        res.json({ hearing });
    }
    catch (error) {
        console.error('Update hearing error:', error);
        res.status(500).json({ error: 'Failed to update hearing' });
    }
});
// GET /api/hearings/judge/:judgeId — all hearings for judge (calendar)
router.get('/judge/:judgeId', auth_1.authenticate, async (req, res) => {
    try {
        const hearings = await Hearing_1.default.find({ judgeId: req.params.judgeId })
            .populate('caseId', 'caseNumber status')
            .sort({ hearingDate: 1 });
        res.json({ hearings });
    }
    catch (error) {
        console.error('Get judge hearings error:', error);
        res.status(500).json({ error: 'Failed to fetch hearings' });
    }
});
// GET /api/hearings/case/:caseId — all hearings for a case
router.get('/case/:caseId', auth_1.authenticate, async (req, res) => {
    try {
        const hearings = await Hearing_1.default.find({ caseId: req.params.caseId }).sort({ hearingDate: 1 });
        res.json({ hearings });
    }
    catch (error) {
        console.error('Get case hearings error:', error);
        res.status(500).json({ error: 'Failed to fetch hearings' });
    }
});
exports.default = router;
