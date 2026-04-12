import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firebaseUid: string;
  email: string;
  role: 'citizen' | 'lawyer' | 'judge' | 'admin';
  systemUid: string; // CIT-2026-00001 / LAW-2026-00001 / JUD-2026-00001
  profile: {
    name: string;
    phone?: string;
    location?: string;
    photoURL?: string;
    courtId?: string;
  };
  fcmToken?: string;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ['citizen', 'lawyer', 'judge', 'admin'],
      required: true,
    },
    systemUid: { type: String, unique: true, sparse: true },
    profile: {
      name: { type: String, required: true },
      phone: String,
      location: String,
      photoURL: String,
      courtId: String,
    },
    fcmToken: String,
    isVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
