import mongoose, { Schema, Document } from 'mongoose';

export interface ICase extends Document {
  caseNumber: string; // MH-2026-00001
  citizenId: mongoose.Types.ObjectId;
  lawyerId?: mongoose.Types.ObjectId;
  judgeId?: mongoose.Types.ObjectId;
  firGridfsId?: mongoose.Types.ObjectId; // GridFS file ID for uploaded FIR
  parsedData: {
    parties: string[];
    date: string;
    location: string;
    offenceDescription: string;
    firNumber?: string;
    policeStation?: string;
    ipcSectionsRaw?: string[];
  };
  ipcSections: Array<{
    section: string;
    act: string;
    title: string;
    description: string;
    isCognizable: boolean;
    isBailable: boolean;
    minPunishmentYears: number;
    maxPunishmentYears: number;
    fineApplicable: boolean;
  }>;
  aiSummary?: string;
  punishmentPrediction?: {
    minYears: number;
    maxYears: number;
    isBailable: boolean;
    fineRange?: string;
    disclaimer?: string;
  };
  timelinePrediction?: {
    minMonths: number;
    maxMonths: number;
    medianMonths: number;
    confidence?: string;
    factors?: string[];
    disclaimer?: string;
  };
  similarCases: Array<{
    caseId: string;
    caseName: string;
    year: number;
    court: string;
    outcome: string;
    similarityScore: number;
  }>;
  status: 'draft' | 'unassigned' | 'pending' | 'active' | 'resolved' | 'closed';
  lastActivityAt: Date;
  hearings: mongoose.Types.ObjectId[];
  evidenceIds: mongoose.Types.ObjectId[];
  grievances: Array<{
    raisedBy: mongoose.Types.ObjectId;
    message: string;
    createdAt: Date;
    resolved: boolean;
  }>;
  auditHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CaseSchema = new Schema<ICase>(
  {
    caseNumber: { type: String, unique: true },
    citizenId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lawyerId: { type: Schema.Types.ObjectId, ref: 'User' },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User' },
    firGridfsId: { type: Schema.Types.ObjectId },
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
    hearings: [{ type: Schema.Types.ObjectId, ref: 'Hearing' }],
    evidenceIds: [{ type: Schema.Types.ObjectId, ref: 'Evidence' }],
    grievances: [
      {
        raisedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        message: String,
        createdAt: { type: Date, default: Date.now },
        resolved: { type: Boolean, default: false },
      },
    ],
    auditHash: String,
  },
  { timestamps: true }
);

export default mongoose.model<ICase>('Case', CaseSchema);
