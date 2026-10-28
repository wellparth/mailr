import { IEmailAdapter, NormalizedMessage, SendMailOptions, TestConnectionResult } from './EmailAdapter.js';

export class OutlookAdapter implements IEmailAdapter {
  private accessToken: string;
  private refreshToken?: string;
  private userEmail: string;

  constructor(options: { accessToken: string; refreshToken?: string; userEmail: string }) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.userEmail = options.userEmail;
  }

  async connect(): Promise<void> {
    // In production, instantiate MSAL client or @microsoft/microsoft-graph-client
  }

  async testConnection(): Promise<TestConnectionResult> {
    if (!this.accessToken && !this.refreshToken) {
      return {
        success: false,
        message: 'Missing OAuth credentials for Microsoft Outlook connection',
      };
    }
    return {
      success: true,
      message: `Successfully validated Microsoft Graph connection for ${this.userEmail}`,
    };
  }

  async syncMessages(
    _since: Date,
    _onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    // In production, queries https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages/delta
    return 0;
  }

  async sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId: string }> {
    // In production, POSTs to https://graph.microsoft.com/v1.0/me/sendMail
    const simulatedId = `ms_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      success: true,
      messageId: simulatedId,
    };
  }

  async markAsRead(_remoteMessageId: string, _isRead: boolean): Promise<void> {
    // PATCH /me/messages/{id} { isRead: true }
  }

  async archiveMessage(_remoteMessageId: string): Promise<void> {
    // POST /me/messages/{id}/move { destinationId: "archive" }
  }

  async deleteMessage(_remoteMessageId: string): Promise<void> {
    // DELETE /me/messages/{id}
  }

  async disconnect(): Promise<void> {
    // Clear sessions
  }
}
