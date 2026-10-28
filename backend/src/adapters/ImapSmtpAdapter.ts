import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, ParsedMail } from 'mailparser';
import {
  IEmailAdapter,
  NormalizedMessage,
  NormalizedAttachment,
  SendMailOptions,
  TestConnectionResult,
} from './EmailAdapter.js';

export interface ImapSmtpConfig {
  userEmail: string;
  password?: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export class ImapSmtpAdapter implements IEmailAdapter {
  private config: ImapSmtpConfig;
  private imapClient?: ImapFlow;
  private smtpTransporter?: nodemailer.Transporter;

  constructor(config: ImapSmtpConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.password) {
      throw new Error('Password required for IMAP/SMTP connection');
    }

    if (!this.imapClient) {
      this.imapClient = new ImapFlow({
        host: this.config.imapHost,
        port: this.config.imapPort,
        secure: this.config.imapSecure,
        auth: {
          user: this.config.userEmail,
          pass: this.config.password,
        },
        logger: false,
      });
    }

    if (!this.smtpTransporter) {
      this.smtpTransporter = nodemailer.createTransport({
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.userEmail,
          pass: this.config.password,
        },
      });
    }
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      await this.connect();

      // Test IMAP Handshake
      let imapOk = false;
      let imapError = '';
      try {
        if (this.imapClient) {
          await this.imapClient.connect();
          imapOk = true;
          await this.imapClient.logout();
        }
      } catch (err: unknown) {
        imapError = err instanceof Error ? err.message : String(err);
      }

      // Test SMTP Handshake
      let smtpOk = false;
      let smtpError = '';
      try {
        if (this.smtpTransporter) {
          await this.smtpTransporter.verify();
          smtpOk = true;
        }
      } catch (err: unknown) {
        smtpError = err instanceof Error ? err.message : String(err);
      }

      if (imapOk && smtpOk) {
        return {
          success: true,
          message: 'Both IMAP incoming and SMTP outgoing connections verified successfully.',
          details: { imap: 'OK', smtp: 'OK' },
        };
      } else {
        return {
          success: false,
          message: `Connection test incomplete: ${[
            !imapOk ? `IMAP: ${imapError}` : 'IMAP: OK',
            !smtpOk ? `SMTP: ${smtpError}` : 'SMTP: OK',
          ].join('; ')}`,
          details: { imapOk, smtpOk, imapError, smtpError },
        };
      }
    } catch (err: unknown) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown connection error',
      };
    }
  }

  /**
   * Syncs messages from the IMAP INBOX folder.
   * Downloads raw RFC-2822 sources and parses with mailparser.
   */
  async syncMessages(
    _since: Date,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    await this.connect();
    if (!this.imapClient) {
      throw new Error('IMAP client is not initialized.');
    }

    try {
      await this.imapClient.connect();
    } catch (err: unknown) {
      console.warn('IMAP already connected or connection notice:', err instanceof Error ? err.message : err);
    }

    const lock = await this.imapClient.getMailboxLock('INBOX');
    try {
      const status = await this.imapClient.status('INBOX', { messages: true, unseen: true });
      const totalMessages = status.messages || 0;

      if (totalMessages === 0) {
        return 0;
      }

      // Fetch the latest 30 messages (or all if < 30)
      const startSeq = Math.max(1, totalMessages - 29);
      const range = `${startSeq}:*`;

      const normalizedBatch: NormalizedMessage[] = [];

      for await (const msg of this.imapClient.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
        internalDate: true,
      })) {
        try {
          if (!msg.source) continue;

          // Parse with mailparser
          const parsed: ParsedMail = await simpleParser(msg.source);

          const isRead = msg.flags ? msg.flags.has('\\Seen') : false;
          const isFlagged = msg.flags ? msg.flags.has('\\Flagged') : false;

          const sender = parsed.from?.value[0] || { name: '', address: '' };

          // Extract recipient emails
          let recipients: string[] = [];
          if (parsed.to) {
            const toList = Array.isArray(parsed.to) ? parsed.to : [parsed.to];
            recipients = toList.flatMap((t) => (t.value ? t.value.map((v) => v.address || '') : []));
          }
          if (recipients.length === 0) {
            recipients = [this.config.userEmail];
          }

          // Extract CC
          let ccList: string[] = [];
          if (parsed.cc) {
            const ccEntries = Array.isArray(parsed.cc) ? parsed.cc : [parsed.cc];
            ccList = ccEntries.flatMap((c) => (c.value ? c.value.map((v) => v.address || '') : []));
          }

          // Extract Attachments (images, PDFs, documents)
          const attachments: NormalizedAttachment[] = (parsed.attachments || []).map((att) => {
            const isImage = att.contentType.startsWith('image/');
            const base64Data = att.content ? att.content.toString('base64') : '';
            return {
              filename: att.filename || 'attachment',
              contentType: att.contentType || 'application/octet-stream',
              sizeBytes: att.size || (att.content ? att.content.length : 0),
              filePath: isImage && base64Data ? `data:${att.contentType};base64,${base64Data}` : '',
              content: att.content,
            };
          });

          // Create snippet
          const plainSnippet = (parsed.text || '')
            .substring(0, 160)
            .replace(/\s+/g, ' ')
            .trim();

          normalizedBatch.push({
            remoteId: String(msg.uid || msg.seq),
            remoteThreadId: parsed.messageId || `thread_${msg.uid || msg.seq}`,
            senderName: sender.name || sender.address?.split('@')[0] || 'Unknown',
            senderEmail: sender.address || 'unknown@domain.com',
            recipients,
            cc: ccList,
            subject: parsed.subject || '(No Subject)',
            snippet: plainSnippet,
            bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
            bodyText: parsed.text || '',
            receivedAt: parsed.date instanceof Date ? parsed.date : (msg.internalDate ? new Date(msg.internalDate) : new Date()),
            isRead,
            isFlagged,
            hasAttachments: attachments.length > 0,
            attachments,
          });
        } catch (parseError) {
          console.error(`Error parsing IMAP message UID ${msg.uid}:`, parseError);
        }
      }

      if (normalizedBatch.length > 0) {
        await onBatch(normalizedBatch);
      }

      return normalizedBatch.length;
    } finally {
      lock.release();
    }
  }

  async sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId: string }> {
    if (!this.smtpTransporter) {
      await this.connect();
    }

    if (!this.smtpTransporter) {
      throw new Error('SMTP transporter is not initialized.');
    }

    const result = await this.smtpTransporter.sendMail({
      from: options.from,
      to: options.to.join(', '),
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      subject: options.subject,
      text: options.bodyText || '',
      html: options.bodyHtml,
    });

    return {
      success: true,
      messageId: result.messageId || `msg_${Date.now()}`,
    };
  }

  async markAsRead(remoteMessageId: string, isRead: boolean): Promise<void> {
    if (!this.imapClient) await this.connect();
    if (!this.imapClient) return;

    try {
      const lock = await this.imapClient.getMailboxLock('INBOX');
      try {
        const uid = Number(remoteMessageId);
        if (!isNaN(uid)) {
          if (isRead) {
            await this.imapClient.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
          } else {
            await this.imapClient.messageFlagsRemove({ uid }, ['\\Seen'], { uid: true });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.warn('Error updating IMAP flags:', err);
    }
  }

  async archiveMessage(remoteMessageId: string): Promise<void> {
    if (!this.imapClient) await this.connect();
    if (!this.imapClient) return;

    try {
      const lock = await this.imapClient.getMailboxLock('INBOX');
      try {
        const uid = Number(remoteMessageId);
        if (!isNaN(uid)) {
          // Attempt to move to Archive mailbox if supported
          try {
            await this.imapClient.messageMove({ uid }, 'Archive', { uid: true });
          } catch {
            // fallback: mark as seen
            await this.imapClient.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.warn('Error archiving IMAP message:', err);
    }
  }

  async deleteMessage(remoteMessageId: string): Promise<void> {
    if (!this.imapClient) await this.connect();
    if (!this.imapClient) return;

    try {
      const lock = await this.imapClient.getMailboxLock('INBOX');
      try {
        const uid = Number(remoteMessageId);
        if (!isNaN(uid)) {
          await this.imapClient.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.warn('Error deleting IMAP message:', err);
    }
  }

  async disconnect(): Promise<void> {
    if (this.imapClient) {
      try {
        await this.imapClient.logout();
      } catch {
        // ignore
      }
    }
  }
}
