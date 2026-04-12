"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = void 0;
exports.initFirebaseAdmin = initFirebaseAdmin;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
let firebaseAdmin;
function initFirebaseAdmin() {
    if (firebase_admin_1.default.apps.length > 0) {
        firebaseAdmin = firebase_admin_1.default.apps[0];
        return firebaseAdmin;
    }
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    firebaseAdmin = firebase_admin_1.default.initializeApp({
        credential: firebase_admin_1.default.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey,
        }),
    });
    console.log('Firebase Admin SDK initialized');
    return firebaseAdmin;
}
