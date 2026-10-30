import { Response } from 'express';
import { EventEmitter } from 'events';
import prisma from '../db.js';
import { decryptSecret, encryptSecret } from '../utils/crypto.js';
import { ImapSmtpAdapter } from '../adapters/ImapSmtpAdapter.js';
import { GmailAdapter } from '../adapters/GmailAdapter.js';
import { OutlookAdapter } from '../adapters/OutlookAdapter.js';
import { AIService } from './aiService.js';
import { NormalizedMessage, IEmailAdapter, SyncOptions } from '../adapters/EmailAdapter.js';
import { ProviderType } from '@prisma/client';

class SyncBroadcaster extends EventEmitter {
  private clients: Map<string, Response[]> = new Map();

  addClient(userId: string, res: Response) {
    const existing = this.clients.get(userId) || [];
    existing.push(res);
    this.clients.set(userId, existing);

    res.on('close', () => {
      const current = this.clients.get(userId) || [];
      this.clients.set(
        userId,
        current.filter((client) => client !== res)
      );
    });
  }

  notifyUser(userId: string, event: string, data: Record<string, unknown>) {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) return;

    const payload = `data: ${JSON.stringify({ type: event, ...data })}\n\n`;
    userClients.forEach((res) => {
      try {
        res.write(payload);
      } catch {
        // ignore closed connections
      }
    });
  }
}

export const syncBroadcaster = new SyncBroadcaster();

export class SyncService {
  /**
   * Syncs an email account by fetching remote messages, running AI triage,
   * saving to MySQL, and notifying connected clients in real time via SSE.
   */
  static async syncAccount(
    accountId: string,
    options?: SyncOptions
  ): Promise<{ success: boolean; ingestedCount: number; message: string }> {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`Email account ${accountId} not found.`);
    }

    // Set status to SYNCING
    await prisma.emailAccount.update({
      where: { id: account.id },
      data: { syncStatus: 'SYNCING' },
    });

    try {
      let adapter: IEmailAdapter;

      if (account.provider === ProviderType.GMAIL && account.encryptedAccessToken) {
        const accessToken = decryptSecret(account.encryptedAccessToken);
        const refreshToken = account.encryptedRefreshToken
          ? decryptSecret(account.encryptedRefreshToken)
          : undefined;
        adapter = new GmailAdapter({
          accessToken,
          refreshToken,
          userEmail: account.emailAddress,
          onTokenRefreshed: async (newToken: string) => {
            await prisma.emailAccount.update({
              where: { id: account.id },
              data: { encryptedAccessToken: encryptSecret(newToken) },
            });
          },
        });
      } else if (account.provider === ProviderType.OUTLOOK && account.encryptedAccessToken) {
        const accessToken = decryptSecret(account.encryptedAccessToken);
        const refreshToken = account.encryptedRefreshToken
          ? decryptSecret(account.encryptedRefreshToken)
          : undefined;
        adapter = new OutlookAdapter({
          accessToken,
          refreshToken,
          userEmail: account.emailAddress,
        });
      } else {
        // IMAP/SMTP (including Gmail & Outlook with App Passwords)
        let password = '';
        if (account.encryptedCredentials) {
          try {
            const parsed = JSON.parse(decryptSecret(account.encryptedCredentials));
            password = parsed.password || '';
          } catch {
            password = decryptSecret(account.encryptedCredentials);
          }
        }

        adapter = new ImapSmtpAdapter({
          userEmail: account.emailAddress,
          password,
          imapHost: account.imapHost || (account.provider === ProviderType.GMAIL ? 'imap.gmail.com' : 'outlook.office365.com'),
          imapPort: account.imapPort || 993,
          imapSecure: true,
          smtpHost: account.smtpHost || (account.provider === ProviderType.GMAIL ? 'smtp.gmail.com' : 'smtp.office365.com'),
          smtpPort: account.smtpPort || 587,
          smtpSecure: false,
        });
      }

      let ingestedCount = 0;
      const sinceDate = account.lastSyncedAt || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // last 30 days

      // Cache existing messages to avoid N SELECT queries
      const existingDbMessages = await prisma.message.findMany({
        where: { accountId: account.id },
        select: { id: true, remoteMessageId: true, isRead: true, isFlagged: true },
      });
      const existingRemoteIds = new Set(existingDbMessages.map((m) => m.remoteMessageId));
      const existingMessageMap = new Map<string, { id: string; isRead: boolean; isFlagged: boolean }>(
        existingDbMessages.map((m) => [m.remoteMessageId, m])
      );

      // Cache thread IDs to avoid repeated thread queries
      const threadCache = new Map<string, any>();

      const syncOpts: SyncOptions = {
        ...options,
        existingRemoteIds,
      };

      await adapter.syncMessages(sinceDate, async (batch: NormalizedMessage[]) => {
        for (const msg of batch) {
          // Check if message already exists in MySQL
          const existingMessage = existingMessageMap.get(msg.remoteId);

          if (existingMessage) {
            // Update read and flagged status if changed
            if (existingMessage.isRead !== msg.isRead || existingMessage.isFlagged !== msg.isFlagged) {
              await prisma.message.update({
                where: { id: existingMessage.id },
                data: {
                  isRead: msg.isRead,
                  isFlagged: msg.isFlagged,
                },
              });
              existingMessage.isRead = msg.isRead;
              existingMessage.isFlagged = msg.isFlagged;
            }
            continue;
          }

          // 1. Run AI Priority Scoring
          const priority = AIService.calculatePriority(
            msg.subject,
            msg.bodyText || msg.bodyHtml || '',
            account.emailAddress
          );

          // 2. Run AI Calendar Proposal Detection
          const proposal = AIService.extractCalendarProposal(
            msg.bodyText || msg.bodyHtml || '',
            msg.subject,
            msg.senderEmail
          );

          // 3. Find or create conversation Thread
          const cleanSubject = msg.subject.replace(/^(re|fwd):\s*/i, '').trim();
          let thread = threadCache.get(msg.remoteThreadId);

          if (!thread) {
            thread = await prisma.thread.findFirst({
              where: {
                accountId: account.id,
                OR: [
                  { remoteThreadId: msg.remoteThreadId },
                  { subject: { contains: cleanSubject ? cleanSubject.substring(0, 50) : msg.subject } },
                ],
              },
            });
          }

          if (!thread) {
            thread = await prisma.thread.create({
              data: {
                accountId: account.id,
                remoteThreadId: msg.remoteThreadId,
                subject: msg.subject,
                snippet: msg.snippet,
                priorityScore: priority.score,
                priorityLevel: priority.level,
                priorityReason: priority.reason,
                lastMessageAt: msg.receivedAt,
              },
            });
            threadCache.set(msg.remoteThreadId, thread);
          } else {
            // Update thread's last message time & highest priority if incoming is newer
            const msgDate = new Date(msg.receivedAt);
            const isNewer = msgDate > new Date(thread.lastMessageAt);
            thread = await prisma.thread.update({
              where: { id: thread.id },
              data: {
                lastMessageAt: isNewer ? msgDate : thread.lastMessageAt,
                snippet: isNewer ? msg.snippet : thread.snippet,
                priorityScore: Math.max(thread.priorityScore, priority.score),
                priorityLevel: priority.score > thread.priorityScore ? priority.level : thread.priorityLevel,
                priorityReason: priority.reason || thread.priorityReason,
              },
            });
            threadCache.set(msg.remoteThreadId, thread);
          }

          // 4. Create Message in Database
          const created = await prisma.message.create({
            data: {
              threadId: thread.id,
              accountId: account.id,
              remoteMessageId: msg.remoteId,
              senderName: msg.senderName,
              senderEmail: msg.senderEmail,
              recipientList: msg.recipients,
              ccList: msg.cc || [],
              bccList: msg.bcc || [],
              subject: msg.subject,
              snippet: msg.snippet,
              bodyHtml: msg.bodyHtml || `<p>${msg.bodyText || ''}</p>`,
              bodyText: msg.bodyText || '',
              isRead: msg.isRead,
              isFlagged: msg.isFlagged,
              hasAttachments: msg.hasAttachments,
              receivedAt: msg.receivedAt,
              attachments:
                msg.attachments && msg.attachments.length > 0
                  ? {
                      create: msg.attachments.map((att) => ({
                        filename: att.filename,
                        contentType: att.contentType,
                        sizeBytes: att.sizeBytes,
                        filePath: att.filePath || '',
                      })),
                    }
                  : undefined,
              calendarProposals:
                proposal
                  ? {
                      create: [
                        {
                          userId: account.userId,
                          title: proposal.title,
                          description: proposal.description,
                          startTime: proposal.startTime,
                          endTime: proposal.endTime,
                          timezone: proposal.timezone,
                          status: 'PROPOSED',
                          attendees: proposal.attendees,
                        },
                      ],
                    }
                  : undefined,
            },
          });

          existingMessageMap.set(msg.remoteId, {
            id: created.id,
            isRead: msg.isRead,
            isFlagged: msg.isFlagged,
          });

          ingestedCount++;
        }

        // Notify client of progress after each batch
        syncBroadcaster.notifyUser(account.userId, 'SYNC_PROGRESS', {
          accountId: account.id,
          ingestedCount,
          timestamp: new Date().toISOString(),
        });
      }, syncOpts);

      // Update account status to CONNECTED & record last synced timestamp
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: {
          syncStatus: 'CONNECTED',
          lastSyncedAt: new Date(),
        },
      });

      // Notify frontend client in real-time via SSE
      syncBroadcaster.notifyUser(account.userId, 'SYNC_COMPLETE', {
        accountId: account.id,
        ingestedCount,
        timestamp: new Date().toISOString(),
      });

      await adapter.disconnect();

      return {
        success: true,
        ingestedCount,
        message: `Synced ${ingestedCount} new message(s) for ${account.emailAddress}.`,
      };
    } catch (err: unknown) {
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { syncStatus: 'ERROR' },
      });
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to sync account ${account.emailAddress}: ${msg}`);
    }
  }

  /**
   * Syncs all connected accounts for a given user.
   */
  static async syncAllUserAccounts(
    userId: string,
    options?: SyncOptions
  ): Promise<{ totalIngested: number; results: Array<{ accountId: string; count: number; error?: string }> }> {
    const accounts = await prisma.emailAccount.findMany({
      where: { userId },
    });

    let totalIngested = 0;
    const results: Array<{ accountId: string; count: number; error?: string }> = [];

    for (const acc of accounts) {
      try {
        const res = await this.syncAccount(acc.id, options);
        totalIngested += res.ingestedCount;
        results.push({ accountId: acc.id, count: res.ingestedCount });
      } catch (err: unknown) {
        results.push({
          accountId: acc.id,
          count: 0,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { totalIngested, results };
  }
}
