import path from 'path';
import { fileURLToPath } from 'url';
import './config/env.js';
import { validateEnv } from './config/validateEnv.js';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import { ensureStudyPlan } from './seed/dsPlan.js';
import { syncUserIndexes } from './config/syncIndexes.js';
import authRoutes from './routes/auth.js';
import planRoutes from './routes/plan.js';
import progressRoutes from './routes/progress.js';
import analyticsRoutes from './routes/analytics.js';
import searchRoutes from './routes/search.js';
import { getCorsConfig } from './config/cors.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

validateEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5050;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  app.set('trust proxy', 1);
}

const { configured: corsOrigins, isAllowed: isOriginAllowed } = getCorsConfig(isProd);

if (isProd) {
  console.log(
    `CORS: ${corsOrigins.join(', ') || 'none configured'} + Vercel (*.vercel.app) deployments`
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.use(notFoundHandler);
app.use(errorHandler);

connectDB()
  .then(async () => {
    await ensureStudyPlan();
    await syncUserIndexes();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
    });
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message || err);
    if (process.env.NODE_ENV === 'production') {
      console.error('Check MONGO_URI, JWT_SECRET, FRONTEND_URL, and PUBLIC_URL in your host env settings.');
    }
    process.exit(1);
  });
