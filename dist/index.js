"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = require("./config/db");
const firebase_1 = require("./config/firebase");
const gridfs_1 = require("./config/gridfs");
const pendingCaseJob_1 = require("./jobs/pendingCaseJob");
const rateLimiter_1 = require("./middleware/rateLimiter");
const auth_1 = __importDefault(require("./routes/auth"));
const cases_1 = __importDefault(require("./routes/cases"));
const fir_1 = __importDefault(require("./routes/fir"));
const lawyers_1 = __importDefault(require("./routes/lawyers"));
const evidence_1 = __importDefault(require("./routes/evidence"));
const hearings_1 = __importDefault(require("./routes/hearings"));
const ai_1 = __importDefault(require("./routes/ai"));
const admin_1 = __importDefault(require("./routes/admin"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const seed_1 = __importDefault(require("./routes/seed"));
const app = (0, express_1.default)();
// Log environment state for debugging
console.log('--- Environment Check ---');
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log(`PORT: ${process.env.PORT}`);
console.log('------------------------');
// Security & parsing
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests from any localhost port (for development flexibility)
        const allowed = !origin || /^http:\/\/localhost:\d+$/.test(origin);
        if (allowed) {
            callback(null, true);
        }
        else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '50mb' }));
app.use(rateLimiter_1.apiLimiter);
// Routes
app.use('/api/auth', auth_1.default);
app.use('/api/cases', cases_1.default);
app.use('/api/fir', fir_1.default);
app.use('/api/lawyers', lawyers_1.default);
app.use('/api/evidence', evidence_1.default);
app.use('/api/hearings', hearings_1.default);
app.use('/api/ai', ai_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/notifications', notifications_1.default);
app.use('/api/seed', seed_1.default);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NyayaSetu API', timestamp: new Date() });
});
// Firebase Admin is initialised early since auth middleware needs it.
(0, firebase_1.initFirebaseAdmin)();
const PORT = process.env.PORT || 5000;
(0, db_1.connectDB)().then(async () => {
    // Initialize GridFS after DB is connected
    (0, gridfs_1.initGridFS)();
    app.listen(PORT, () => {
        console.log(`NyayaSetu backend running on port ${PORT}`);
    });
    (0, pendingCaseJob_1.startPendingCaseJob)();
    await (0, pendingCaseJob_1.lockOverdueEvidence)();
});
