import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { simpleParser, ParsedMail } from 'mailparser';
import {
  IEmailAdapter,
  NormalizedMessage,
  NormalizedAttachment,
  SendMailOptions,
  TestConnectionResult,
  SyncOptions,
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
   * Discovers the exact server mailbox path for a standard role (INBOX, SENT, TRASH, ARCHIVE, DRAFTS).
   * Checks both RFC 6154 specialUse attributes and standard international naming heuristics.
   */
  async discoverMailbox(role: 'INBOX' | 'SENT' | 'TRASH' | 'ARCHIVE' | 'DRAFTS'): Promise<string> {
    if (role === 'INBOX') return 'INBOX';
    if (!this.imapClient) return role;

    try {
      const list = await this.imapClient.list();
      const targetSpecial = `\\${role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()}`;
      
      // 1. Check RFC 6154 specialUse
      const bySpecialUse = list.find((m) => m.specialUse === targetSpecial);
      if (bySpecialUse && bySpecialUse.path) return bySpecialUse.path;

      // 2. Comprehensive heuristics for common mail providers (Gmail, Outlook, Yahoo, Dovecot, Postfix)
      const patterns: Record<string, RegExp> = {
        SENT: /^(sent|sent items|sent messages|\[gmail\]\/sent mail|inbox[\/\.]sent)$/i,
        TRASH: /^(trash|deleted|deleted items|bin|\[gmail\]\/trash|\[gmail\]\/bin|inbox[\/\.]trash)$/i,
        ARCHIVE: /^(archive|archives|all mail|\[gmail\]\/all mail|inbox[\/\.]archive)$/i,
        DRAFTS: /^(drafts|\[gmail\]\/drafts|inbox[\/\.]drafts)$/i,
      };

      const regex = patterns[role];
      if (regex) {
        const byName = list.find((m) => regex.test(m.path) || regex.test(m.name));
        if (byName && byName.path) return byName.path;
      }
    } catch (err) {
      console.warn(`[ImapSmtpAdapter] Mailbox discovery error for ${role}:`, err);
    }

    return role;
  }

  /**
   * Syncs messages from a specific IMAP mailbox.
   */
  private async syncMailbox(
    folderPath: string,
    folderType: 'INBOX' | 'SENT' | 'TRASH' | 'ARCHIVE' | 'DRAFTS',
    maxTarget: number,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    if (!this.imapClient) return 0;
    let lock;
    try {
      lock = await this.imapClient.getMailboxLock(folderPath);
    } catch (lockErr) {
      console.warn(`[ImapSmtpAdapter] Could not acquire lock for ${folderPath}:`, lockErr);
      return 0;
    }

    try {
      const status = await this.imapClient.status(folderPath, { messages: true, unseen: true });
      const totalMessages = status.messages || 0;

      if (totalMessages === 0) {
        return 0;
      }

      const startSeq = Math.max(1, totalMessages - maxTarget + 1);
      const range = `${startSeq}:*`;

      let normalizedBatch: NormalizedMessage[] = [];
      let totalSynced = 0;

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

          const isRead = folderType === 'SENT' ? true : (msg.flags ? msg.flags.has('\\Seen') : false);
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

          const senderEmail = sender.address || (folderType === 'SENT' ? this.config.userEmail : 'unknown@domain.com');
          const senderName = sender.name || (folderType === 'SENT' ? 'Me' : sender.address?.split('@')[0] || 'Unknown');

          // Extract List-Unsubscribe header & detect newsletter patterns
          let unsubscribeUrl: string | undefined;
          const rawUnsub = parsed.headers?.get('list-unsubscribe');
          if (typeof rawUnsub === 'string') {
            const match = rawUnsub.match(/<([^>]+)>/);
            if (match && /^https?:\/\//i.test(match[1])) {
              unsubscribeUrl = match[1];
            }
          }
          if (!unsubscribeUrl && parsed.html) {
            const unsubHtmlMatch = parsed.html.match(/href=["'](https?:\/\/[^"']*(?:unsubscribe|optout|opt-out|preferences)[^"']*)["']/i);
            if (unsubHtmlMatch) {
              unsubscribeUrl = unsubHtmlMatch[1];
            }
          }

          const hasListId = Boolean(parsed.headers?.get('list-id'));
          const senderLower = senderEmail.toLowerCase();
          const subjectLower = (parsed.subject || '').toLowerCase();
          const textLower = (parsed.text || '').toLowerCase();

          const isNewsletter = Boolean(
            unsubscribeUrl ||
            hasListId ||
            rawUnsub ||
            /newsletter|substack|medium\.com|digest|weekly|monthly|curated|bulletin|mailer|marketing|updates@/i.test(senderLower) ||
            /\[newsletter\]|weekly digest|monthly digest|issue #\d+|edition #\d+/i.test(subjectLower) ||
            (textLower.includes('unsubscribe') && (textLower.includes('preferences') || textLower.includes('view in browser')))
          );

          normalizedBatch.push({
            remoteId: folderType === 'INBOX' ? String(msg.uid || msg.seq) : `${folderType.toLowerCase()}_${msg.uid || msg.seq}`,
            remoteThreadId: parsed.messageId || `thread_${folderType.toLowerCase()}_${msg.uid || msg.seq}`,
            senderName,
            senderEmail,
            recipients,
            cc: ccList,
            subject: parsed.subject || '(No Subject)',
            snippet: plainSnippet,
            bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
            bodyText: parsed.text || '',
            receivedAt: parsed.date instanceof Date ? parsed.date : (msg.internalDate ? new Date(msg.internalDate) : new Date()),
            isRead,
            isFlagged,
            isArchived: folderType === 'ARCHIVE' || folderType === 'TRASH',
            hasAttachments: attachments.length > 0,
            attachments,
            folder: folderType,
            unsubscribeUrl,
            isNewsletter,
          });

          if (normalizedBatch.length >= 25) {
            await onBatch(normalizedBatch);
            totalSynced += normalizedBatch.length;
            normalizedBatch = [];
          }
        } catch (parseError) {
          console.error(`Error parsing IMAP message UID ${msg.uid} in ${folderPath}:`, parseError);
        }
      }

      if (normalizedBatch.length > 0) {
        await onBatch(normalizedBatch);
        totalSynced += normalizedBatch.length;
      }

      return totalSynced;
    } finally {
      lock.release();
    }
  }

  /**
   * Syncs messages across multi-folder hierarchy (INBOX and SENT folders).
   * Downloads raw RFC-2822 sources and parses with mailparser.
   */
  async syncMessages(
    _since: Date,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>,
    options?: SyncOptions
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

    // 1. If explicit folder requested
    if (options?.folder) {
      const targetRole = options.folder.toUpperCase() as 'INBOX' | 'SENT' | 'TRASH' | 'ARCHIVE' | 'DRAFTS';
      const folderPath = await this.discoverMailbox(targetRole);
      const maxTarget = options?.maxMessages || (options?.fullSync ? 1000 : 300);
      return await this.syncMailbox(folderPath, targetRole, maxTarget, onBatch);
    }

    let totalSynced = 0;

    // 2. Sync INBOX
    const inboxTarget = options?.maxMessages || (options?.fullSync ? 1000 : 300);
    totalSynced += await this.syncMailbox('INBOX', 'INBOX', inboxTarget, onBatch);

    // 3. Sync Sent folder so emails sent externally or on mobile devices are retained locally
    try {
      const sentPath = await this.discoverMailbox('SENT');
      if (sentPath) {
        const sentTarget = options?.fullSync ? 300 : 100;
        totalSynced += await this.syncMailbox(sentPath, 'SENT', sentTarget, onBatch);
      }
    } catch (sentErr) {
      console.warn('[ImapSmtpAdapter] Optional SENT folder sync skipped:', sentErr);
    }

    return totalSynced;
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
        const rawUid = remoteMessageId.replace(/^[a-z]+_/i, '');
        const uid = Number(rawUid);
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
      const archiveMailbox = await this.discoverMailbox('ARCHIVE');
      const lock = await this.imapClient.getMailboxLock('INBOX');
      try {
        const rawUid = remoteMessageId.replace(/^[a-z]+_/i, '');
        const uid = Number(rawUid);
        if (!isNaN(uid)) {
          // Attempt to move to Archive mailbox if supported and distinct from INBOX
          if (archiveMailbox && archiveMailbox.toUpperCase() !== 'INBOX') {
            try {
              await this.imapClient.messageMove({ uid }, archiveMailbox, { uid: true });
            } catch {
              // fallback: mark as seen
              await this.imapClient.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
            }
          } else {
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
      const trashMailbox = await this.discoverMailbox('TRASH');
      const lock = await this.imapClient.getMailboxLock('INBOX');
      try {
        const rawUid = remoteMessageId.replace(/^[a-z]+_/i, '');
        const uid = Number(rawUid);
        if (!isNaN(uid)) {
          if (trashMailbox && trashMailbox.toUpperCase() !== 'INBOX') {
            try {
              await this.imapClient.messageMove({ uid }, trashMailbox, { uid: true });
            } catch {
              await this.imapClient.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
            }
          } else {
            await this.imapClient.messageFlagsAdd({ uid }, ['\\Deleted'], { uid: true });
          }
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      console.warn('Error deleting IMAP message:', err);
    }
  }

  /**
   * On-demand download of an attachment from IMAP mail server.
   */
  async getAttachment(remoteMessageId: string, attachmentId: string, filename?: string): Promise<{ data: Buffer; contentType: string } | null> {
    if (!this.imapClient) await this.connect();
    if (!this.imapClient) return null;

    try {
      await this.imapClient.connect();
    } catch {}

    const isSent = remoteMessageId.startsWith('sent_');
    const folder = isSent ? await this.discoverMailbox('SENT') : 'INBOX';
    const lock = await this.imapClient.getMailboxLock(folder);
    try {
      const rawUid = remoteMessageId.replace(/^[a-z]+_/i, '');
      const uid = Number(rawUid);
      if (isNaN(uid)) return null;

      const msg = await this.imapClient.fetchOne(uid, { source: true }, { uid: true });
      if (!msg || !msg.source) return null;

      const parsed: ParsedMail = await simpleParser(msg.source);
      if (!parsed.attachments || parsed.attachments.length === 0) return null;

      // Find attachment by filename or index
      let target = parsed.attachments.find((att) => att.filename === filename);
      if (!target && !isNaN(Number(attachmentId))) {
        const idx = Number(attachmentId) - 1;
        target = parsed.attachments[idx];
      }
      if (!target && parsed.attachments.length > 0) {
        target = parsed.attachments[0];
      }

      if (target && target.content) {
        return {
          data: target.content,
          contentType: target.contentType || 'application/octet-stream',
        };
      }
      return null;
    } finally {
      lock.release();
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
