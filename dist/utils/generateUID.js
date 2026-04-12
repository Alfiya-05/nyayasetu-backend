"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSystemUID = generateSystemUID;
exports.generateCaseNumber = generateCaseNumber;
const mongoose_1 = __importDefault(require("mongoose"));
const ROLE_PREFIX = {
    citizen: 'CIT',
    lawyer: 'LAW',
    judge: 'JUD',
    admin: 'ADM',
};
// Counter collection for concurrency-safe sequential IDs
const CounterSchema = new mongoose_1.default.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
});
const Counter = mongoose_1.default.model('Counter', CounterSchema);
async function getNextSequence(name) {
    const counter = await Counter.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
    return counter.seq;
}
async function generateSystemUID(role) {
    const prefix = ROLE_PREFIX[role] ?? 'USR';
    const year = new Date().getFullYear();
    const seq = await getNextSequence(`uid_${role}_${year}`);
    const paddedSeq = String(seq).padStart(5, '0');
    return `${prefix}-${year}-${paddedSeq}`;
}
async function generateCaseNumber() {
    const year = new Date().getFullYear();
    const seq = await getNextSequence(`case_${year}`);
    const paddedSeq = String(seq).padStart(5, '0');
    return `MH-${year}-${paddedSeq}`;
}
