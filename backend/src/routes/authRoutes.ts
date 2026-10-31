import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../db.js';
import { generateToken, authMiddleware, AuthenticatedRequest, JWT_SECRET } from '../middleware/auth.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { SyncService } from '../services/syncService.js';
import { ProviderType } from '@prisma/client';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// In-memory store for single-use OAuth exchange codes (replaces exposing raw JWTs in GET URLs)
interface ExchangeCodeData {
  token: string;
  user: { id: string; email: string; name: string };
  expiresAt: number;
}
const exchangeCodes = new Map<string, ExchangeCodeData>();

// Helper to generate RFC 6749 compliant HMAC-signed OAuth state parameter
function generateOAuthState(provider: string): string {
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now().toString();
  const payload = `${provider}:${nonce}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${payload}:${signature}`;
}

// Helper to verify OAuth state parameter and prevent CSRF
function verifyOAuthState(state: string | undefined, expectedProvider: string): boolean {
  if (!state || typeof state !== 'string') return false;
  const parts = state.split(':');
  if (parts.length !== 4) return false;
  const [provider, nonce, timestampStr, signature] = parts;
  if (provider !== expectedProvider) return false;

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp) || Date.now() - timestamp > 10 * 60 * 1000) {
    return false; // Expired after 10 minutes
  }

  const payload = `${provider}:${nonce}:${timestampStr}`;
  const hmac = crypto.createHmac('sha256', JWT_SECRET);
  hmac.update(payload);
  const expectedSig = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
  }
}

// 0. Single-use Code Exchange for OAuth callback
router.post('/exchange-code', (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Exchange code is required' });
    return;
  }

  const entry = exchangeCodes.get(code);
  if (!entry) {
    res.status(401).json({ error: 'Invalid or expired exchange code' });
    return;
  }

  exchangeCodes.delete(code); // Enforce single-use

  if (entry.expiresAt < Date.now()) {
    res.status(401).json({ error: 'Exchange code has expired' });
    return;
  }

  res.json({
    success: true,
    token: entry.token,
    user: entry.user,
  });
});

// 1. Google OAuth - Generate Authorization URL
router.get('/google/url', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`;

  if (!clientId || clientId.trim() === '') {
    res.json({
      configured: false,
      url: null,
      message: 'GOOGLE_CLIENT_ID not configured in backend .env',
    });
    return;
  }

  const scope = [
    'openid',
    'email',
    'profile',
    'https://mail.google.com/',
  ].join(' ');

  const state = generateOAuthState('google');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });

  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  if (req.query.redirect === 'true') {
    res.redirect(url);
    return;
  }

  res.json({ configured: true, url });
});

// 2. Google OAuth - Exchange Code Callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${frontendUrl}/login?error=missing_auth_code`);
      return;
    }

    // Verify OAuth CSRF state parameter
    if (!verifyOAuthState(typeof state === 'string' ? state : undefined, 'google')) {
      res.redirect(`${frontendUrl}/login?error=invalid_or_expired_oauth_state`);
      return;
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri =
      process.env.GOOGLE_REDIRECT_URI ||
      `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`;

    if (!clientId || !clientSecret) {
      res.redirect(`${frontendUrl}/login?error=google_oauth_credentials_missing_in_env`);
      return;
    }

    // Exchange code for Google OAuth tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok || !tokenData.access_token) {
      res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          tokenData.error_description || tokenData.error || 'token_exchange_failed'
        )}`
      );
      return;
    }

    // Retrieve user profile from Google UserInfo endpoint
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await profileRes.json()) as any;

    const email = profile.email;
    const name = profile.name || email.split('@')[0];

    // Find or create User
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: randomPassword,
        },
      });
    }

    // Encrypt tokens with AES-256-GCM zero-knowledge encryption
    const encryptedAccessToken = encryptSecret(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptSecret(tokenData.refresh_token)
      : encryptSecret('google_oauth_offline_' + Date.now());

    const account = await prisma.emailAccount.upsert({
      where: {
        userId_emailAddress: {
          userId: user.id,
          emailAddress: email,
        },
      },
      update: {
        provider: ProviderType.GMAIL,
        displayName: name,
        colorCode: '#ea4335',
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: ProviderType.GMAIL,
        emailAddress: email,
        displayName: name,
        colorCode: '#ea4335',
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    // Auto-trigger initial inbox synchronization immediately in the background
    SyncService.syncAccount(account.id).catch((syncErr) => {
      console.warn('[Google OAuth] Initial background inbox sync failed:', syncErr);
    });

    const jwtToken = generateToken({ id: user.id, email: user.email });
    const authExchangeCode = crypto.randomBytes(24).toString('hex');
    exchangeCodes.set(authExchangeCode, {
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name || '' },
      expiresAt: Date.now() + 60000,
    });

    res.redirect(
      `${frontendUrl}/app?code=${authExchangeCode}&email=${encodeURIComponent(
        email
      )}&provider=GMAIL`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Google OAuth failed';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
  }
});

// 3. Microsoft Outlook - Generate Authorization URL
router.get('/microsoft/url', (req: Request, res: Response) => {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/microsoft/callback`;

  if (!clientId || clientId.trim() === '') {
    res.json({
      configured: false,
      url: null,
      message: 'MICROSOFT_CLIENT_ID not configured in backend .env',
    });
    return;
  }

  const scope = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'https://graph.microsoft.com/Mail.ReadWrite',
    'https://graph.microsoft.com/Mail.Send',
  ].join(' ');

  const state = generateOAuthState('microsoft');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope,
    prompt: 'select_account',
    state,
  });

  const url = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

  if (req.query.redirect === 'true') {
    res.redirect(url);
    return;
  }

  res.json({ configured: true, url });
});

// 4. Microsoft Outlook - Exchange Code Callback
router.get('/microsoft/callback', async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const { code, state, error } = req.query;

    if (error) {
      res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code || typeof code !== 'string') {
      res.redirect(`${frontendUrl}/login?error=missing_auth_code`);
      return;
    }

    // Verify OAuth CSRF state parameter
    if (!verifyOAuthState(typeof state === 'string' ? state : undefined, 'microsoft')) {
      res.redirect(`${frontendUrl}/login?error=invalid_or_expired_oauth_state`);
      return;
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri =
      process.env.MICROSOFT_REDIRECT_URI ||
      `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/microsoft/callback`;

    if (!clientId || !clientSecret) {
      res.redirect(`${frontendUrl}/login?error=microsoft_oauth_credentials_missing_in_env`);
      return;
    }

    // Exchange authorization code for Microsoft Graph tokens
    const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenRes.json()) as any;
    if (!tokenRes.ok || !tokenData.access_token) {
      res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(
          tokenData.error_description || tokenData.error || 'microsoft_token_exchange_failed'
        )}`
      );
      return;
    }

    // Fetch user profile from Microsoft Graph API
    const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await userRes.json()) as any;

    const email = profile.mail || profile.userPrincipalName;
    const name = profile.displayName || email.split('@')[0];

    // Find or create User
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const randomPassword = await bcrypt.hash(Math.random().toString(36) + Date.now(), 10);
      user = await prisma.user.create({
        data: {
          email,
          name,
          passwordHash: randomPassword,
        },
      });
    }

    // Encrypt tokens with AES-256-GCM zero-knowledge encryption
    const encryptedAccessToken = encryptSecret(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? encryptSecret(tokenData.refresh_token)
      : encryptSecret('ms_oauth_offline_' + Date.now());

    await prisma.emailAccount.upsert({
      where: {
        userId_emailAddress: {
          userId: user.id,
          emailAddress: email,
        },
      },
      update: {
        provider: ProviderType.OUTLOOK,
        displayName: name,
        colorCode: '#0078d4',
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: ProviderType.OUTLOOK,
        emailAddress: email,
        displayName: name,
        colorCode: '#0078d4',
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    const jwtToken = generateToken({ id: user.id, email: user.email });
    const authExchangeCode = crypto.randomBytes(24).toString('hex');
    exchangeCodes.set(authExchangeCode, {
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name || '' },
      expiresAt: Date.now() + 60000,
    });

    res.redirect(
      `${frontendUrl}/app?code=${authExchangeCode}&email=${encodeURIComponent(
        email
      )}&provider=OUTLOOK`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Microsoft OAuth failed';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(msg)}`);
  }
});

// 5. Direct / Modal OAuth Login & Account Provisioning (Secured)
router.post('/oauth', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { provider, email, name, accessToken, refreshToken } = req.body;
    if (!email || !provider) {
      res.status(400).json({ error: 'Email and provider are required for OAuth' });
      return;
    }

    const providerEnum =
      provider.toLowerCase() === 'google' || provider.toLowerCase() === 'gmail'
        ? ProviderType.GMAIL
        : ProviderType.OUTLOOK;

    let verifiedEmail = '';
    let verifiedName = name;

    // Verify token with identity provider if provided
    if (accessToken) {
      if (providerEnum === ProviderType.GMAIL) {
        const verifyRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!verifyRes.ok) {
          res.status(401).json({ error: 'OAuth verification failed: Invalid Google token' });
          return;
        }
        const profile = (await verifyRes.json()) as any;
        if (!profile.email || profile.email.toLowerCase() !== email.toLowerCase()) {
          res.status(401).json({ error: 'OAuth verification failed: Token identity mismatch' });
          return;
        }
        verifiedEmail = profile.email;
        verifiedName = profile.name || verifiedName;
      } else {
        const verifyRes = await fetch('https://graph.microsoft.com/v1.0/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!verifyRes.ok) {
          res.status(401).json({ error: 'OAuth verification failed: Invalid Microsoft token' });
          return;
        }
        const profile = (await verifyRes.json()) as any;
        const msEmail = (profile.mail || profile.userPrincipalName || '').toLowerCase();
        if (!msEmail || msEmail !== email.toLowerCase()) {
          res.status(401).json({ error: 'OAuth verification failed: Token identity mismatch' });
          return;
        }
        verifiedEmail = msEmail;
        verifiedName = profile.displayName || verifiedName;
      }
    } else {
      // If no accessToken is provided:
      if (process.env.NODE_ENV === 'production') {
        res.status(401).json({ error: 'OAuth access token is required for authentication' });
        return;
      }

      // In development: never allow claiming an existing registered user without credentials!
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(403).json({
          error: 'Account already registered. Please log in with password or use verified OAuth.',
        });
        return;
      }
      verifiedEmail = email;
    }

    // 1. Find or create User with verified email
    let user = await prisma.user.findUnique({ where: { email: verifiedEmail } });
    if (!user) {
      const randomPassword = (await bcrypt.hash(Math.random().toString(36) + Date.now(), 10));
      user = await prisma.user.create({
        data: {
          email: verifiedEmail,
          name: verifiedName || verifiedEmail.split('@')[0],
          passwordHash: randomPassword,
        },
      });
    }

    // 2. Find or create connected EmailAccount for this user
    const colorCode = providerEnum === ProviderType.GMAIL ? '#ea4335' : '#0078d4';
    const encryptedAccessToken = accessToken ? encryptSecret(accessToken) : encryptSecret('oauth_token_active_' + Date.now());
    const encryptedRefreshToken = refreshToken ? encryptSecret(refreshToken) : encryptSecret('oauth_refresh_active_' + Date.now());

    const account = await prisma.emailAccount.upsert({
      where: {
        userId_emailAddress: {
          userId: user.id,
          emailAddress: verifiedEmail,
        },
      },
      update: {
        provider: providerEnum,
        displayName: verifiedName || verifiedEmail.split('@')[0],
        colorCode,
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
      create: {
        userId: user.id,
        provider: providerEnum,
        emailAddress: verifiedEmail,
        displayName: verifiedName || verifiedEmail.split('@')[0],
        colorCode,
        encryptedAccessToken,
        encryptedRefreshToken,
        syncStatus: 'CONNECTED',
        lastSyncedAt: new Date(),
      },
    });

    const token = generateToken({ id: user.id, email: user.email });

    res.json({
      success: true,
      message: `Successfully authenticated via ${providerEnum}. Mailbox is ready.`,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      account: {
        id: account.id,
        emailAddress: account.emailAddress,
        displayName: account.displayName,
        provider: account.provider,
        colorCode: account.colorCode,
      },
      token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'OAuth authentication failed';
    res.status(500).json({ error: msg });
  }
});

// Register new user
router.post('/register', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        passwordHash,
      },
    });

    const token = generateToken({ id: user.id, email: user.email });
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// Login
router.post('/login', authRateLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ id: user.id, email: user.email });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        aiProvider: user.aiProvider,
        hasAiKey: Boolean(user.encryptedAiKey),
      },
      token,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// Get Current User Profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        aiProvider: true,
        encryptedAiKey: true,
        accounts: {
          select: {
            id: true,
            provider: true,
            emailAddress: true,
            displayName: true,
            colorCode: true,
            syncStatus: true,
            lastSyncedAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        aiProvider: user.aiProvider,
        hasAiKey: Boolean(user.encryptedAiKey),
        accounts: user.accounts,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// Save Encrypted AI Key (BYOK)
router.post('/ai-key', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { aiProvider, apiKey } = req.body;
    if (!apiKey) {
      res.status(400).json({ error: 'API key is required' });
      return;
    }

    const encryptedKey = encryptSecret(apiKey);

    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        aiProvider: aiProvider || 'openai',
        encryptedAiKey: encryptedKey,
      },
    });

    res.json({
      success: true,
      message: 'AI API key encrypted with AES-256-GCM and saved successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

export default router;
