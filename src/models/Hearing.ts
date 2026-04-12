import mongoose, { Schema, Document } from 'mongoose';

export interface IHearing extends Document {
  caseId: mongoose.Types.ObjectId;
  judgeId?: mongoose.Types.ObjectId;
  lawyerId?: mongoose.Types.ObjectId;
  citizenId?: mongoose.Types.ObjectId;
  hearingDate: Date;
  courtRoom?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  notificationSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HearingSchema = new Schema<IHearing>(
  {
    caseId: { type: Schema.Types.ObjectId, ref: 'Case', required: true },
    judgeId: { type: Schema.Types.ObjectId, ref: 'User' },
    lawyerId: { type: Schema.Types.ObjectId, ref: 'User' },
    citizenId: { type: Schema.Types.ObjectId, ref: 'User' },
    hearingDate: { type: Date, required: true },
    courtRoom: String,
    notes: String,
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'],
      default: 'scheduled',
    },
    notificationSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IHearing>('Hearing', HearingSchema);
