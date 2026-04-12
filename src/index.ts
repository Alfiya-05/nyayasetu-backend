import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

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

// Log environment state for debugging
console.log('--- Environment Check ---');
console.log(`FRONTEND_URL: ${process.env.FRONTEND_URL}`);
console.log(`PORT: ${process.env.PORT}`);
console.log('------------------------');

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: "*",
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(apiLimiter);

// Routes
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'NyayaSetu API', timestamp: new Date() });
});

app.get('/', (_req, res) => {
  res.send('NyayaSetu Backend Running 🚀');
});

// Firebase Admin is initialised early since auth middleware needs it.
initFirebaseAdmin();
const PORT = process.env.PORT || 8080;

connectDB().then(async () => {
  // Initialize GridFS after DB is connected
  initGridFS();

  app.listen(PORT, () => {
    console.log(`NyayaSetu backend running on port ${PORT}`);
  });

  startPendingCaseJob();
  await lockOverdueEvidence();
});
