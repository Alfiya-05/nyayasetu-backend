"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.firebaseNotify = firebaseNotify;
const firebase_1 = require("../config/firebase");
const User_1 = __importDefault(require("../models/User"));
async function firebaseNotify(options) {
    try {
        let tokens = [];
        if (options.userIds && options.userIds.length > 0) {
            const users = await User_1.default.find({
                _id: { $in: options.userIds },
                fcmToken: { $exists: true, $ne: null },
            }).select('fcmToken');
            tokens = users.map((u) => u.fcmToken).filter(Boolean);
        }
        else if (options.roles && options.roles.length > 0) {
            const users = await User_1.default.find({
                role: { $in: options.roles },
                fcmToken: { $exists: true, $ne: null },
            }).select('fcmToken');
            tokens = users.map((u) => u.fcmToken).filter(Boolean);
        }
        if (tokens.length === 0)
            return;
        const message = {
            notification: {
                title: options.title,
                body: options.body,
            },
            data: {
                ...(options.caseId ? { caseId: options.caseId } : {}),
                ...(options.data ?? {}),
            },
            tokens,
        };
        await firebase_1.admin.messaging().sendEachForMulticast(message);
    }
    catch (error) {
        // Notification failures should not crash the main flow
        console.error('FCM notification error:', error);
    }
}
