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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const CaseSchema = new mongoose_1.Schema({
    caseNumber: { type: String, unique: true },
    citizenId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    lawyerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    judgeId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    firGridfsId: { type: mongoose_1.Schema.Types.ObjectId },
    parsedData: {
        parties: [String],
        date: String,
        location: String,
        offenceDescription: String,
        firNumber: String,
        policeStation: String,
        ipcSectionsRaw: [String],
    },
    ipcSections: [
        {
            section: String,
            act: String,
            title: String,
            description: String,
            isCognizable: Boolean,
            isBailable: Boolean,
            minPunishmentYears: Number,
            maxPunishmentYears: Number,
            fineApplicable: Boolean,
        },
    ],
    aiSummary: String,
    punishmentPrediction: {
        minYears: Number,
        maxYears: Number,
        isBailable: Boolean,
        fineRange: String,
        disclaimer: String,
    },
    timelinePrediction: {
        minMonths: Number,
        maxMonths: Number,
        medianMonths: Number,
        confidence: String,
        factors: [String],
        disclaimer: String,
    },
    similarCases: [
        {
            caseId: String,
            caseName: String,
            year: Number,
            court: String,
            outcome: String,
            similarityScore: Number,
        },
    ],
    status: {
        type: String,
        enum: ['draft', 'unassigned', 'pending', 'active', 'resolved', 'closed'],
        default: 'unassigned',
    },
    lastActivityAt: { type: Date, default: Date.now },
    hearings: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Hearing' }],
    evidenceIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Evidence' }],
    grievances: [
        {
            raisedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
            message: String,
            createdAt: { type: Date, default: Date.now },
            resolved: { type: Boolean, default: false },
        },
    ],
    auditHash: String,
}, { timestamps: true });
exports.default = mongoose_1.default.model('Case', CaseSchema);
