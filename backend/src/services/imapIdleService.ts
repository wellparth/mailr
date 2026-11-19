import { ImapFlow } from 'imapflow';
import prisma from '../db.js';
import { decryptSecret } from '../utils/crypto.js';
import { SyncService } from './syncService.js';

export interface IdleListenerStatus {
  accountId: string;
  emailAddress: string;
  host: string;
  status: 'CONNECTING' | 'IDLING' | 'RECONNECTING' | 'FALLBACK_POLL' | 'STOPPED';
  connectedAt?: string;
  lastEventAt?: string;
  reconnectAttempts: number;
}

interface ActiveListener {
  accountId: string;
  emailAddress: string;
  host: string;
  status: 'CONNECTING' | 'IDLING' | 'RECONNECTING' | 'FALLBACK_POLL' | 'STOPPED';
  connectedAt?: Date;
  lastEventAt?: Date;
  reconnectAttempts: number;
  client?: ImapFlow;
  releaseLock?: () => void;
  debounceTimer?: NodeJS.Timeout;
  stop: () => Promise<void>;
}

export class ImapIdleService {
  private static listeners: Map<string, ActiveListener> = new Map();
  private static isShuttingDown = false;

  /**
   * Starts a real-time IMAP IDLE listener for an account.
   * If the account lacks IMAP credentials or the mail server does not support IDLE,
   * it falls back gracefully to periodic polling.
   */
  static async startListenerForAccount(account: {
    id: string;
    emailAddress: string;
    imapHost?: string | null;
    imapPort?: number | null;
    imapSecure?: boolean | null;
    encryptedCredentials?: string | null;
    syncStatus?: string;
  }): Promise<void> {
    // Stop any existing listener for this account
    if (this.listeners.has(account.id)) {
      await this.stopListenerForAccount(account.id);
    }

    if (!account.imapHost || !account.encryptedCredentials) {
      this.listeners.set(account.id, {
        accountId: account.id,
        emailAddress: account.emailAddress,
        host: account.imapHost || 'N/A',
        status: 'FALLBACK_POLL',
        reconnectAttempts: 0,
        stop: async () => {},
      });
      return;
    }

    let password = '';
    try {
      const decrypted = decryptSecret(account.encryptedCredentials);
      try {
        const parsed = JSON.parse(decrypted);
        password = parsed.password || '';
      } catch {
        password = decrypted;
      }
    } catch (err) {
      console.warn(`[IMAP IDLE] Could not decrypt credentials for ${account.emailAddress}:`, err);
      return;
    }

    let isStopped = false;
    let lockReleaseFn: (() => void) | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const listenerState: ActiveListener = {
      accountId: account.id,
      emailAddress: account.emailAddress,
      host: account.imapHost,
      status: 'CONNECTING',
      reconnectAttempts: 0,
      stop: async () => {
        isStopped = true;
        listenerState.status = 'STOPPED';
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (listenerState.debounceTimer) clearTimeout(listenerState.debounceTimer);
        if (lockReleaseFn) {
          try {
            lockReleaseFn();
          } catch {
            // ignore
          }
        }
        if (listenerState.client) {
          try {
            await listenerState.client.logout();
          } catch {
            // ignore
          }
        }
        this.listeners.delete(account.id);
      },
    };

    this.listeners.set(account.id, listenerState);

    const connectAndIdle = async () => {
      if (isStopped || this.isShuttingDown) return;

      try {
        listenerState.status = 'CONNECTING';

        const client = new ImapFlow({
          host: account.imapHost!,
          port: account.imapPort || 993,
          secure: account.imapSecure ?? true,
          auth: {
            user: account.emailAddress,
            pass: password,
          },
          logger: false,
          maxIdleTime: 25 * 60 * 1000, // 25-minute keep-alive ping
        });

        listenerState.client = client;

        // Debounced sync trigger when IMAP exists notification fires
        const triggerDebouncedSync = () => {
          listenerState.lastEventAt = new Date();
          if (listenerState.debounceTimer) clearTimeout(listenerState.debounceTimer);

          listenerState.debounceTimer = setTimeout(async () => {
            try {
              console.log(`[IMAP IDLE] Push event received for ${account.emailAddress} - executing sub-second sync...`);
              const syncRes = await SyncService.syncAccount(account.id);
              console.log(`[IMAP IDLE] Sub-second sync completed for ${account.emailAddress} (${syncRes.ingestedCount} new email(s)).`);
            } catch (err) {
              console.error(`[IMAP IDLE] Sync execution error for ${account.emailAddress}:`, err);
            }
          }, 350);
        };

        // Event: New email notification pushed over TCP socket
        client.on('exists', (data) => {
          console.log(`[IMAP IDLE] Socket notification: new email exists in ${data.path} (count: ${data.count}) on ${account.emailAddress}`);
          triggerDebouncedSync();
        });

        // Event: Message flags updated or expunged
        client.on('flags', () => triggerDebouncedSync());
        client.on('expunge', () => triggerDebouncedSync());

        // Event: Connection closed or errored
        client.on('close', () => {
          if (!isStopped && !this.isShuttingDown) {
            listenerState.status = 'RECONNECTING';
            const backoffMs = Math.min(30000, 2000 * Math.pow(1.5, listenerState.reconnectAttempts++));
            console.warn(`[IMAP IDLE] Connection closed for ${account.emailAddress}. Reconnecting in ${Math.round(backoffMs / 1000)}s...`);
            reconnectTimeout = setTimeout(connectAndIdle, backoffMs);
          }
        });

        client.on('error', (err: any) => {
          console.warn(`[IMAP IDLE] Socket warning on ${account.emailAddress}:`, err.message);
        });

        await client.connect();

        // Check if server supports IDLE capability
        if (!client.capabilities.has('IDLE')) {
          console.warn(`[IMAP IDLE] Server ${account.imapHost} does not support IMAP IDLE. Falling back to periodic sync.`);
          listenerState.status = 'FALLBACK_POLL';
          await client.logout();
          return;
        }

        // Acquire mailbox lock for INBOX
        const lock = await client.getMailboxLock('INBOX');
        lockReleaseFn = () => lock.release();
        listenerState.releaseLock = lockReleaseFn;

        listenerState.status = 'IDLING';
        listenerState.connectedAt = new Date();
        listenerState.reconnectAttempts = 0;
        console.log(`[IMAP IDLE] Active and listening for push notifications on ${account.emailAddress} (INBOX locked).`);

        // Enter persistent IDLE loop
        while (!isStopped && !this.isShuttingDown && client.usable) {
          try {
            await client.idle();
          } catch (idleErr: any) {
            if (isStopped || this.isShuttingDown) break;
            console.warn(`[IMAP IDLE] IDLE loop cycle ended for ${account.emailAddress}:`, idleErr?.message);
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      } catch (err: any) {
        if (!isStopped && !this.isShuttingDown) {
          listenerState.status = 'RECONNECTING';
          const backoffMs = Math.min(30000, 2000 * Math.pow(1.5, listenerState.reconnectAttempts++));
          console.warn(`[IMAP IDLE] Connect failed for ${account.emailAddress}: ${err.message}. Retrying in ${Math.round(backoffMs / 1000)}s...`);
          reconnectTimeout = setTimeout(connectAndIdle, backoffMs);
        }
      }
    };

    // Run connection asynchronously in background
    connectAndIdle().catch((err) => {
      console.error(`[IMAP IDLE] Unexpected failure starting listener for ${account.emailAddress}:`, err);
    });
  }

  /**
   * Starts IDLE listeners for all connected email accounts in the database.
   */
  static async startAll(): Promise<void> {
    this.isShuttingDown = false;
    try {
      const accounts = await prisma.emailAccount.findMany({
        where: { syncStatus: { not: 'ERROR' } },
        select: {
          id: true,
          emailAddress: true,
          imapHost: true,
          imapPort: true,
          imapSecure: true,
          encryptedCredentials: true,
          syncStatus: true,
        },
      });

      console.log(`[IMAP IDLE] Initializing push listeners for ${accounts.length} active account(s)...`);
      for (const account of accounts) {
        await this.startListenerForAccount(account);
      }
    } catch (err) {
      console.error('[IMAP IDLE] Error initializing all listeners:', err);
    }
  }

  /**
   * Gracefully stops the listener for a given account.
   */
  static async stopListenerForAccount(accountId: string): Promise<void> {
    const listener = this.listeners.get(accountId);
    if (listener) {
      await listener.stop();
      this.listeners.delete(accountId);
    }
  }

  /**
   * Gracefully stops all active IDLE listeners (for clean server shutdown).
   */
  static async stopAll(): Promise<void> {
    this.isShuttingDown = true;
    console.log(`[IMAP IDLE] Stopping all ${this.listeners.size} active listener(s)...`);
    const stops = Array.from(this.listeners.values()).map((l) => l.stop());
    await Promise.allSettled(stops);
    this.listeners.clear();
  }

  /**
   * Returns diagnostics and live status for all listeners.
   */
  static getStatus(): IdleListenerStatus[] {
    return Array.from(this.listeners.values()).map((l) => ({
      accountId: l.accountId,
      emailAddress: l.emailAddress,
      host: l.host,
      status: l.status,
      connectedAt: l.connectedAt?.toISOString(),
      lastEventAt: l.lastEventAt?.toISOString(),
      reconnectAttempts: l.reconnectAttempts,
    }));
  }
}
