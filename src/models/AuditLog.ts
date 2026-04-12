import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  action: string; // 'EVIDENCE_DELETED' | 'HEARING_UPDATED' | 'CASE_STATUS_CHANGED' etc.
  performedBy: mongoose.Types.ObjectId;
  performedByRole: string;
  targetEntity: string; // 'evidence' | 'case' | 'hearing' | 'user'
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string;
  timestamp: Date;
  hash: string; // SHA-256 of (action+performedBy+timestamp+prevHash) for tamper detection
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, required: true },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByRole: String,
    targetEntity: String,
    targetId: String,
    metadata: { type: Schema.Types.Mixed, default: {} },
    ipAddress: String,
    timestamp: { type: Date, default: Date.now },
    hash: { type: String, required: true },
  },
  { timestamps: false }
);

export default mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
