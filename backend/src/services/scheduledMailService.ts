import prisma from '../db.js';
import { SyncService, syncBroadcaster } from './syncService.js';

export class ScheduledMailService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start(intervalMs: number = 30000) {
    if (this.timer) return;

    console.log(`[ScheduledMailService] Background worker started (polling every ${intervalMs / 1000}s)`);
    this.timer = setInterval(() => {
      this.processDueMessages().catch((err) => {
        console.error('[ScheduledMailService] Error processing due messages:', err);
      });
    }, intervalMs);

    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  static stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  static async processDueMessages(): Promise<number> {
    if (this.isRunning) return 0;
    this.isRunning = true;

    try {
      const now = new Date();
      const dueMessages = await prisma.message.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
        },
        include: {
          account: true,
          thread: true,
          attachments: true,
        },
        take: 20,
      });

      if (dueMessages.length === 0) {
        return 0;
      }

      console.log(`[ScheduledMailService] Found ${dueMessages.length} scheduled email(s) ready for delivery.`);

      let sentCount = 0;
      for (const msg of dueMessages) {
        try {
          const account = msg.account;
          const recipients = Array.isArray(msg.recipientList)
            ? (msg.recipientList as string[])
            : [String(msg.recipientList)];

          const cc = Array.isArray(msg.ccList) ? (msg.ccList as string[]) : undefined;
          const bcc = Array.isArray(msg.bccList) ? (msg.bccList as string[]) : undefined;

          const adapter = await SyncService.getAdapterForAccount(account);
          const sendResult = await adapter.sendMail({
            from: account.displayName
              ? `"${account.displayName}" <${account.emailAddress}>`
              : account.emailAddress,
            to: recipients,
            cc,
            bcc,
            subject: msg.subject,
            bodyHtml: msg.bodyHtml || `<p>${msg.bodyText}</p>`,
            bodyText: msg.bodyText || msg.bodyHtml || '',
            attachments: msg.attachments?.map((att) => ({
              filename: att.filename,
              content: Buffer.from(att.filePath?.replace(/^data:.*?;base64,/, '') || '', 'base64'),
              contentType: att.contentType,
            })),
          });

          // Mark message as SENT and update remote id
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              status: 'SENT',
              remoteMessageId: sendResult.messageId || `msg_sent_${Date.now()}`,
            },
          });

          syncBroadcaster.notifyUser(account.userId, 'SCHEDULED_MAIL_SENT', {
            messageId: msg.id,
            threadId: msg.threadId,
            subject: msg.subject,
            recipient: recipients[0] || 'recipient',
          });

          sentCount++;
          console.log(`[ScheduledMailService] Successfully dispatched scheduled email ${msg.id} (${msg.subject})`);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[ScheduledMailService] Failed to dispatch scheduled email ${msg.id}:`, errMsg);
          // Mark error state so it doesn't spin indefinitely
          await prisma.message.update({
            where: { id: msg.id },
            data: {
              status: 'FAILED',
            },
          });
        }
      }

      return sentCount;
    } finally {
      this.isRunning = false;
    }
  }
}
