"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLogger = auditLogger;
const crypto_1 = __importDefault(require("crypto"));
const AuditLog_1 = __importDefault(require("../models/AuditLog"));
async function auditLogger(entry) {
    // Get the hash of the last audit log entry for chain integrity
    const lastLog = await AuditLog_1.default.findOne().sort({ timestamp: -1 }).select('hash').lean();
    const prevHash = lastLog?.hash ?? 'GENESIS';
    const timestamp = new Date();
    const hashInput = `${entry.action}${entry.performedBy}${timestamp.toISOString()}${prevHash}`;
    const hash = crypto_1.default.createHash('sha256').update(hashInput).digest('hex');
    await AuditLog_1.default.create({
        action: entry.action,
        performedBy: entry.performedBy,
        performedByRole: entry.performedByRole,
        targetEntity: entry.targetEntity,
        targetId: entry.targetId,
        metadata: entry.metadata ?? {},
        ipAddress: entry.ipAddress,
        timestamp,
        hash,
    });
}
