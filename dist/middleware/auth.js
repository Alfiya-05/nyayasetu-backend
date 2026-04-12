"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const firebase_1 = require("../config/firebase");
const User_1 = __importDefault(require("../models/User"));
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Missing authorization token' });
        return;
    }
    const token = authHeader.split('Bearer ')[1];
    try {
        const decoded = await firebase_1.admin.auth().verifyIdToken(token);
        const user = await User_1.default.findOne({ firebaseUid: decoded.uid });
        if (!user) {
            res.status(404).json({ error: 'User not registered in system. Please complete registration.' });
            return;
        }
        req.user = user;
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
