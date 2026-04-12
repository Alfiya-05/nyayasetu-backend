import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

// 🔍 ENV DEBUG
console.log("🔍 ENV CHECK START");
console.log("MONGO_URI:", process.env.MONGO_URI ? "OK ✅" : "MISSING ❌");
console.log("FIREBASE_PROJECT_ID:", process.env.FIREBASE_PROJECT_ID ? "OK ✅" : "MISSING ❌");
console.log("FIREBASE_CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL ? "OK ✅" : "MISSING ❌");
console.log("FIREBASE_PRIVATE_KEY:", process.env.FIREBASE_PRIVATE_KEY ? "OK ✅" : "MISSING ❌");
console.log("🔍 ENV CHECK END");

// Imports
import { connectDB } from './config/db';
import { initFirebaseAdmin } from './config/firebase';
import { initGridFS } from './config/gridfs';
import { startPendingCaseJob, lockOverdueEvidence } from './jobs/pendingCaseJob';
import { apiLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth';
import casesRoutes from './routes/cases';
import firRoutes from './routes/fir';
import lawyersRoutes from './routes/lawyers';
import evidenceRoutes from './routes/evidence';
import hearingsRoutes from './routes/hearings';
import aiRoutes from './routes/ai';
import adminRoutes from './routes/admin';
import notificationsRoutes from './routes/notifications';
import seedRoutes from './routes/seed';

const app = express();

// 🌍 ENV LOG
console.log('--- Environment Check ---');
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log(`PORT: ${process.env.PORT}`);
console.log('------------------------');

// 🔐 Middleware
app.use(helmet());
app.use(cors({
  origin: "*",
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(apiLimiter);

// 🚀 Routes
app.use('/api/auth', authRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/fir', firRoutes);
app.use('/api/lawyers', lawyersRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/hearings', hearingsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/seed', seedRoutes);

// ❤️ Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'NyayaSetu API', timestamp: new Date() });
});

// 🏠 Root
app.get('/', (_req, res) => {
  res.send('NyayaSetu Backend Running 🚀');
});

// 🔥 Firebase Init (SAFE)
try {
  initFirebaseAdmin();
  console.log("✅ Firebase initialized");
} catch (err) {
  console.error("❌ Firebase ERROR:", err);
}

// 🚀 Server Start
const PORT = process.env.PORT || 8080;

connectDB()
  .then(async () => {
    console.log("✅ MongoDB Connected");

    initGridFS();

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    startPendingCaseJob();
    await lockOverdueEvidence();
  })
  .catch((err) => {
    console.error("❌ DB CONNECTION FAILED:", err);
  });
