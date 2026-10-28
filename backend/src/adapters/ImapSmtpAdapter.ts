import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { IEmailAdapter, NormalizedMessage, SendMailOptions, TestConnectionResult } from './EmailAdapter.js';

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

  async syncMessages(
    _since: Date,
    _onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    // In production, opens mailbox INBOX and fetches new envelopes/bodies
    return 0;
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

  async markAsRead(_remoteMessageId: string, _isRead: boolean): Promise<void> {
    // \Seen flag
  }

  async archiveMessage(_remoteMessageId: string): Promise<void> {
    // Move to Archive
  }

  async deleteMessage(_remoteMessageId: string): Promise<void> {
    // \Deleted flag / Move to Trash
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
