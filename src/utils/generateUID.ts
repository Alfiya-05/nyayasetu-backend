import User from '../models/User';
import mongoose from 'mongoose';

const ROLE_PREFIX: Record<string, string> = {
  citizen: 'CIT',
  lawyer: 'LAW',
  judge: 'JUD',
  admin: 'ADM',
};

// Counter collection for concurrency-safe sequential IDs
const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model('Counter', CounterSchema);

async function getNextSequence(name: string): Promise<number> {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter!.seq;
}

export async function generateSystemUID(role: string): Promise<string> {
  const prefix = ROLE_PREFIX[role] ?? 'USR';
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`uid_${role}_${year}`);
  const paddedSeq = String(seq).padStart(5, '0');
  return `${prefix}-${year}-${paddedSeq}`;
}

export async function generateCaseNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`case_${year}`);
  const paddedSeq = String(seq).padStart(5, '0');
  return `MH-${year}-${paddedSeq}`;
}
