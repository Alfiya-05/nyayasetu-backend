import crypto from 'crypto';
import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog';

interface AuditEntry {
  action: string;
  performedBy: mongoose.Types.ObjectId;
  performedByRole: string;
  targetEntity: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

export async function auditLogger(entry: AuditEntry): Promise<void> {
  // Get the hash of the last audit log entry for chain integrity
  const lastLog = await AuditLog.findOne().sort({ timestamp: -1 }).select('hash').lean();
  const prevHash = lastLog?.hash ?? 'GENESIS';

  const timestamp = new Date();
  const hashInput = `${entry.action}${entry.performedBy}${timestamp.toISOString()}${prevHash}`;
  const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

  await AuditLog.create({
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
