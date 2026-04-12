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
exports.startPendingCaseJob = startPendingCaseJob;
exports.lockOverdueEvidence = lockOverdueEvidence;
const node_cron_1 = __importDefault(require("node-cron"));
const Case_1 = __importDefault(require("../models/Case"));
function startPendingCaseJob() {
    // Run daily at midnight — shift inactive cases to pending
    node_cron_1.default.schedule('0 0 * * *', async () => {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        try {
            const updated = await Case_1.default.updateMany({
                status: 'active',
                lastActivityAt: { $lt: threeMonthsAgo },
            }, { $set: { status: 'pending' } });
            console.log(`[CRON] Auto-shifted ${updated.modifiedCount} inactive cases to pending status.`);
        }
        catch (error) {
            console.error('[CRON] Pending case job failed:', error);
        }
    });
    // Run every minute — lock evidence uploaded > 15 min ago
    node_cron_1.default.schedule('* * * * *', async () => {
        try {
            await lockOverdueEvidence();
        }
        catch (error) {
            console.error('[CRON] Evidence lock job failed:', error);
        }
    });
    console.log('[CRON] Pending case + evidence lock jobs scheduled');
}
// Also lock evidence that should have been locked but wasn't (e.g., server restart)
async function lockOverdueEvidence() {
    const { default: Evidence } = await Promise.resolve().then(() => __importStar(require('../models/Evidence')));
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const result = await Evidence.updateMany({
        isImmutable: false,
        uploadTimestamp: { $lt: fifteenMinutesAgo },
        deletedAt: { $exists: false },
    }, { $set: { isImmutable: true } });
    if (result.modifiedCount > 0) {
        console.log(`[STARTUP] Locked ${result.modifiedCount} overdue evidence records.`);
    }
}
