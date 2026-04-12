import mongoose, { Schema, Document } from 'mongoose';

export interface IEvidence extends Document {
  caseId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  uploaderRole: 'citizen' | 'lawyer' | 'judge';
  uploaderName: string;
  gridfsId: mongoose.Types.ObjectId; // GridFS file ObjectId
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash?: string;
  description?: string;
  uploadTimestamp: Date;
  isImmutable: boolean; // true after 15 minutes
  deletedAt?: Date;
  deletionLog?: string;
  virusScanPassed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<IEvidence>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploaderRole: { type: String, enum: ['citizen', 'lawyer', 'judge'] },
    uploaderName: { type: String, required: true },
    gridfsId: { type: Schema.Types.ObjectId },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSizeBytes: Number,
    sha256Hash: String,
    description: String,
    uploadTimestamp: { type: Date, default: Date.now },
    isImmutable: { type: Boolean, default: false },
    deletedAt: Date,
    deletionLog: String,
    virusScanPassed: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model<IEvidence>('Evidence', EvidenceSchema);
