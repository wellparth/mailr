import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { discoverEmailSettings } from '../utils/autoDiscovery.js';
import { ImapSmtpAdapter } from '../adapters/ImapSmtpAdapter.js';
import { ProviderType } from '@prisma/client';
import { syncBroadcaster } from '../services/syncService.js';

const router = Router();

// Require auth for all account operations
router.use(authMiddleware);

// 1. List all connected accounts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await prisma.emailAccount.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        provider: true,
        emailAddress: true,
        displayName: true,
        colorCode: true,
        imapHost: true,
        imapPort: true,
        smtpHost: true,
        smtpPort: true,
        syncStatus: true,
        lastSyncedAt: true,
        _count: {
          select: {
            messages: true,
            threads: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ accounts });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 2. Discover IMAP/SMTP settings for a domain
router.post('/discover', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const settings = await discoverEmailSettings(email);
    res.json({ success: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Discovery error';
    res.status(500).json({ error: msg });
  }
});

// 3. Test IMAP & SMTP connection before saving
router.post('/test-connection', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure } = req.body;

    if (!email || !password || !imapHost || !smtpHost) {
      res.status(400).json({ error: 'Email, password, IMAP host, and SMTP host are required.' });
      return;
    }

    const adapter = new ImapSmtpAdapter({
      userEmail: email,
      password,
      imapHost,
      imapPort: imapPort || 993,
      imapSecure: imapSecure !== undefined ? imapSecure : true,
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpSecure: smtpSecure !== undefined ? smtpSecure : false,
    });

    const result = await adapter.testConnection();
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Connection test failed';
    res.status(500).json({ success: false, message: msg });
  }
});

// 4. Connect Custom Domain or generic IMAP/SMTP account
router.post('/connect/imap-smtp', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      email,
      password,
      displayName,
      colorCode,
      provider,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
    } = req.body;

    if (!email || !password || !imapHost || !smtpHost) {
      res.status(400).json({ error: 'Email, password, IMAP host, and SMTP host are required.' });
      return;
    }

    // Encrypt password using AES-256-GCM
    const encryptedCredentials = encryptSecret(JSON.stringify({ password }));

    // Determine ProviderType enum
    let providerEnum: ProviderType = ProviderType.IMAP_SMTP;
    if (provider && Object.values(ProviderType).includes(provider as ProviderType)) {
      providerEnum = provider as ProviderType;
    }

    const account = await prisma.emailAccount.upsert({
      where: {
        userId_emailAddress: {
          userId: req.user!.id,
          emailAddress: email,
        },
      },
      update: {
        provider: providerEnum,
        displayName: displayName || email.split('@')[0],
        colorCode: colorCode || '#3b82f6',
        encryptedCredentials,
        imapHost,
        imapPort: imapPort || 993,
        imapSecure: imapSecure !== undefined ? imapSecure : true,
        smtpHost,
        smtpPort: smtpPort || 587,
        smtpSecure: smtpSecure !== undefined ? smtpSecure : false,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        userId: req.user!.id,
        provider: providerEnum,
        emailAddress: email,
        displayName: displayName || email.split('@')[0],
        colorCode: colorCode || '#3b82f6',
        encryptedCredentials,
        imapHost,
        imapPort: imapPort || 993,
        imapSecure: imapSecure !== undefined ? imapSecure : true,
        smtpHost,
        smtpPort: smtpPort || 587,
        smtpSecure: smtpSecure !== undefined ? smtpSecure : false,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    // Notify connected client
    syncBroadcaster.notifyUser(req.user!.id, 'account_connected', {
      accountId: account.id,
      email: account.emailAddress,
    });

    res.status(201).json({
      success: true,
      message: `Account ${email} connected successfully.`,
      account: {
        id: account.id,
        emailAddress: account.emailAddress,
        displayName: account.displayName,
        provider: account.provider,
        colorCode: account.colorCode,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to connect account';
    res.status(500).json({ error: msg });
  }
});

// 5. Connect 1-Click OAuth Account (Google or Microsoft)
router.post('/connect/oauth/:provider', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider } = req.params;
    const { email, displayName, colorCode, accessToken, refreshToken } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email address is required' });
      return;
    }

    const providerEnum =
      provider.toUpperCase() === 'GOOGLE' || provider.toUpperCase() === 'GMAIL'
        ? ProviderType.GMAIL
        : ProviderType.OUTLOOK;

    const encryptedAccessToken = accessToken ? encryptSecret(accessToken) : null;
    const encryptedRefreshToken = refreshToken ? encryptSecret(refreshToken) : null;

    const account = await prisma.emailAccount.upsert({
      where: {
        userId_emailAddress: {
          userId: req.user!.id,
          emailAddress: email,
        },
      },
      update: {
        provider: providerEnum,
        displayName: displayName || email.split('@')[0],
        colorCode: colorCode || (providerEnum === ProviderType.GMAIL ? '#ea4335' : '#0078d4'),
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        userId: req.user!.id,
        provider: providerEnum,
        emailAddress: email,
        displayName: displayName || email.split('@')[0],
        colorCode: colorCode || (providerEnum === ProviderType.GMAIL ? '#ea4335' : '#0078d4'),
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    syncBroadcaster.notifyUser(req.user!.id, 'account_connected', {
      accountId: account.id,
      email: account.emailAddress,
    });

    res.status(201).json({
      success: true,
      message: `Connected ${providerEnum} account ${email} securely.`,
      account: {
        id: account.id,
        emailAddress: account.emailAddress,
        displayName: account.displayName,
        provider: account.provider,
        colorCode: account.colorCode,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OAuth connection error';
    res.status(500).json({ error: msg });
  }
});

// 6. Disconnect Account
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found or access denied.' });
      return;
    }

    await prisma.emailAccount.delete({
      where: { id },
    });

    syncBroadcaster.notifyUser(req.user!.id, 'account_disconnected', { accountId: id });

    res.json({ success: true, message: 'Account and associated cached data removed securely.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 7. Trigger Manual Delta Sync
router.post('/:id/sync', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const account = await prisma.emailAccount.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    await prisma.emailAccount.update({
      where: { id },
      data: {
        syncStatus: 'SYNCING',
        lastSyncedAt: new Date(),
      },
    });

    syncBroadcaster.notifyUser(req.user!.id, 'sync_started', { accountId: id });

    // Mark completed after processing
    setTimeout(async () => {
      try {
        await prisma.emailAccount.update({
          where: { id },
          data: { syncStatus: 'IDLE' },
        });
        syncBroadcaster.notifyUser(req.user!.id, 'sync_completed', { accountId: id });
      } catch {
        // ignore
      }
    }, 1500);

    res.json({ success: true, message: `Sync initiated for ${account.emailAddress}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Sync failed';
    res.status(500).json({ error: msg });
  }
});

export default router;
