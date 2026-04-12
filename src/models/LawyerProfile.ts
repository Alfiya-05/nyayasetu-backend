import mongoose, { Schema, Document } from 'mongoose';

export interface ILawyerProfile extends Document {
  userId: mongoose.Types.ObjectId;
  barNumber: string;
  post?: string; // e.g. 'Senior Advocate – Supreme Court'
  specialisations: string[];
  courtIds: string[];
  experienceYears: number;
  feePerHearing: number; // INR
  retainerFee: number; // INR
  rating: number;
  totalCases: number;
  isAvailable: boolean;
  isBarVerified: boolean;
  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LawyerProfileSchema = new Schema<ILawyerProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    barNumber: { type: String, required: true },
    post: String,
    specialisations: [String],
    courtIds: [String],
    experienceYears: { type: Number, default: 0 },
    feePerHearing: { type: Number, default: 0 },
    retainerFee: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    totalCases: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
    isBarVerified: { type: Boolean, default: false },
    bio: String,
  },
  { timestamps: true }
);

export default mongoose.model<ILawyerProfile>('LawyerProfile', LawyerProfileSchema);
