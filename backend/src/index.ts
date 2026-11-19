import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import automationRoutes from './routes/automationRoutes.js';

import { SyncService } from './services/syncService.js';
import { ScheduledMailService } from './services/scheduledMailService.js';
import { ImapIdleService } from './services/imapIdleService.js';
import { AIService } from './services/aiService.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import prisma from './db.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ],
    credentials: true,
  })
);

// Disable fingerprinting header
app.disable('x-powered-by');

// Defensive HTTP Security Headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Mailr Core API',
    database: 'MySQL (mailr_dev)',
  });
});

// Global API rate limiting
app.use('/api', apiRateLimiter);

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/automations', automationRoutes);

// Global Error Handler
app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Mailr Backend API listening on http://localhost:${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);

  // Start Scheduled Mail Worker
  ScheduledMailService.start(30000);

  // Start Real-Time IMAP IDLE Push Listeners (sub-second inbound push ingestion)
  ImapIdleService.startAll().catch((err) => {
    console.error('[IMAP IDLE] Initialization error:', err);
  });

  // Start periodic background sync worker (safety-net polling for non-IDLE accounts; default: 45s)
  const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '45000', 10);
  let isSyncing = false;

  setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const activeAccounts = await prisma.emailAccount.findMany({
        where: { syncStatus: { not: 'ERROR' } },
        select: { id: true, emailAddress: true },
      });

      if (activeAccounts.length > 0) {
        console.log(`[BackgroundSync] Running periodic sync for ${activeAccounts.length} account(s)...`);
      }

      for (const acc of activeAccounts) {
        try {
          await SyncService.syncAccount(acc.id);
        } catch (err) {
          console.warn(`[BackgroundSync] Account ${acc.emailAddress} sync warning:`, err);
        }
      }

      // Autonomous AI Agent Background Audit (Runs 24/7 on server even when user is offline)
      try {
        const audit = await AIService.auditAndClassifyExistingThreads();
        if (audit.classifiedCount > 0) {
          console.log(`[AIAgent] Autonomously classified & flagged ${audit.classifiedCount} incoming/unclassified thread(s) on server.`);
        }
      } catch (auditErr) {
        console.warn('[AIAgent] Background thread audit notice:', auditErr);
      }
    } catch (err) {
      console.error('[BackgroundSync] Scheduled sync loop error:', err);
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
});

// Graceful process termination
process.on('SIGTERM', async () => {
  await ImapIdleService.stopAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await ImapIdleService.stopAll();
  process.exit(0);
});

export default app;
