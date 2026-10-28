import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import accountRoutes from './routes/accountRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

import { SyncService } from './services/syncService.js';
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

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/ai', aiRoutes);

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

  // Start periodic background sync worker (polls active accounts every 3 minutes)
  const SYNC_INTERVAL_MS = 3 * 60 * 1000;
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
    } catch (err) {
      console.error('[BackgroundSync] Scheduled sync loop error:', err);
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
});

export default app;
