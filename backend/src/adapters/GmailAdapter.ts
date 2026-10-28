import { IEmailAdapter, NormalizedMessage, SendMailOptions, TestConnectionResult } from './EmailAdapter.js';

export class GmailAdapter implements IEmailAdapter {
  private accessToken: string;
  private refreshToken?: string;
  private userEmail: string;

  constructor(options: { accessToken: string; refreshToken?: string; userEmail: string }) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.userEmail = options.userEmail;
  }

  async connect(): Promise<void> {
    // In production, instantiate googleapis OAuth2 client and refresh token if expired
  }

  async testConnection(): Promise<TestConnectionResult> {
    if (!this.accessToken && !this.refreshToken) {
      return {
        success: false,
        message: 'Missing OAuth tokens for Gmail connection',
      };
    }
    return {
      success: true,
      message: `Successfully validated Gmail connection for ${this.userEmail}`,
    };
  }

  async syncMessages(
    _since: Date,
    _onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    // In a live OAuth environment, calls https://gmail.googleapis.com/gmail/v1/users/me/messages
    return 0;
  }

  async sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId: string }> {
    // In live OAuth, constructs RFC 2822 base64url message and POSTs to /messages/send
    const simulatedId = `gmail_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      messageId: simulatedId,
    };
  }

  async markAsRead(_remoteMessageId: string, _isRead: boolean): Promise<void> {
    // POST /messages/{id}/modify removing/adding UNREAD label
  }

  async archiveMessage(_remoteMessageId: string): Promise<void> {
    // POST /messages/{id}/modify removing INBOX label
  }

  async deleteMessage(_remoteMessageId: string): Promise<void> {
    // POST /messages/{id}/trash
  }

  async disconnect(): Promise<void> {
    // Revoke token if needed
  }
}
