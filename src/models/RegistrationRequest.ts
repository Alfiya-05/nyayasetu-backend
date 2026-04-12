import mongoose, { Schema, Document } from 'mongoose';

export interface IRegistrationRequest extends Document {
  firebaseUid: string;
  name: string;
  email: string;
  role: 'lawyer' | 'judge';
  licenseNumber: string;
  mobile: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const RegistrationRequestSchema = new Schema<IRegistrationRequest>(
  {
    firebaseUid: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['lawyer', 'judge'], required: true },
    licenseNumber: { type: String, required: true },
    mobile: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model<IRegistrationRequest>('RegistrationRequest', RegistrationRequestSchema);
