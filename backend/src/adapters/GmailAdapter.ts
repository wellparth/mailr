import { IEmailAdapter, NormalizedMessage, SendMailOptions, TestConnectionResult } from './EmailAdapter.js';

export interface GmailAdapterOptions {
  accessToken: string;
  refreshToken?: string;
  userEmail: string;
  onTokenRefreshed?: (newAccessToken: string) => Promise<void>;
}

export class GmailAdapter implements IEmailAdapter {
  private accessToken: string;
  private refreshToken?: string;
  private userEmail: string;
  private onTokenRefreshed?: (newAccessToken: string) => Promise<void>;

  constructor(options: GmailAdapterOptions) {
    this.accessToken = options.accessToken;
    this.refreshToken = options.refreshToken;
    this.userEmail = options.userEmail;
    this.onTokenRefreshed = options.onTokenRefreshed;
  }

  /**
   * Internal fetch with auto-refresh on 401 Unauthorized
   */
  private async authenticatedFetch(url: string, init?: RequestInit): Promise<Response> {
    let res = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    if (res.status === 401 && this.refreshToken) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        res = await fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Authorization: `Bearer ${this.accessToken}`,
          },
        });
      }
    }

    return res;
  }

  /**
   * Refresh Google OAuth Access Token
   */
  private async refreshAccessToken(): Promise<boolean> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret || !this.refreshToken) {
      return false;
    }

    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!res.ok) return false;

      const data = (await res.json()) as any;
      if (data.access_token) {
        this.accessToken = data.access_token;
        if (this.onTokenRefreshed) {
          await this.onTokenRefreshed(data.access_token);
        }
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    // Validate connectivity
    await this.testConnection();
  }

  async testConnection(): Promise<TestConnectionResult> {
    try {
      const res = await this.authenticatedFetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile'
      );

      if (!res.ok) {
        const body = await res.text();
        return {
          success: false,
          message: `Gmail profile check failed (${res.status}): ${body}`,
        };
      }

      const data = (await res.json()) as any;
      return {
        success: true,
        message: `Successfully connected to Gmail for ${data.emailAddress || this.userEmail}`,
        details: data,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Gmail error';
      return { success: false, message: msg };
    }
  }

  /**
   * Parse email body text & HTML from Gmail message payload parts recursively
   */
  private parseMessagePayload(payload: any): { bodyText?: string; bodyHtml?: string } {
    let bodyText = '';
    let bodyHtml = '';

    const decodeBase64 = (data: string) => {
      try {
        const normalized = data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(normalized, 'base64').toString('utf8');
      } catch {
        return '';
      }
    };

    const traverseParts = (part: any) => {
      if (!part) return;

      if (part.mimeType === 'text/plain' && part.body?.data) {
        bodyText += decodeBase64(part.body.data);
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        bodyHtml += decodeBase64(part.body.data);
      }

      if (part.parts && Array.isArray(part.parts)) {
        for (const subPart of part.parts) {
          traverseParts(subPart);
        }
      }
    };

    if (payload.body?.data) {
      if (payload.mimeType === 'text/html') {
        bodyHtml = decodeBase64(payload.body.data);
      } else {
        bodyText = decodeBase64(payload.body.data);
      }
    }

    if (payload.parts && Array.isArray(payload.parts)) {
      for (const part of payload.parts) {
        traverseParts(part);
      }
    }

    return { bodyText: bodyText || undefined, bodyHtml: bodyHtml || undefined };
  }

  /**
   * Sync inbox messages directly from Gmail REST API
   */
  async syncMessages(
    _since: Date,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>
  ): Promise<number> {
    try {
      // 1. Fetch message list from user's inbox (up to 30 most recent messages)
      const listUrl = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=30&q=in:inbox';
      const listRes = await this.authenticatedFetch(listUrl);

      if (!listRes.ok) {
        const body = await listRes.text();
        console.warn(`[GmailAdapter] Message list error (${listRes.status}):`, body);
        return 0;
      }

      const listData = (await listRes.json()) as any;
      const rawList = listData.messages || [];
      if (rawList.length === 0) {
        return 0;
      }

      const normalizedBatch: NormalizedMessage[] = [];

      // 2. Fetch full message details for each message
      for (const item of rawList) {
        try {
          const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
          const msgRes = await this.authenticatedFetch(msgUrl);
          if (!msgRes.ok) continue;

          const msg = (await msgRes.json()) as any;
          const headers: Record<string, string> = {};
          for (const h of msg.payload?.headers || []) {
            headers[h.name.toLowerCase()] = h.value;
          }

          // Parse sender
          const fromHeader = headers['from'] || 'Unknown Sender';
          let senderName = fromHeader;
          let senderEmail = fromHeader;
          const match = fromHeader.match(/(.*?)\s*<([^>]+)>/);
          if (match) {
            senderName = match[1].replace(/["']/g, '').trim() || match[2];
            senderEmail = match[2].trim();
          }

          // Parse recipients
          const toHeader = headers['to'] || this.userEmail;
          const recipients = toHeader.split(',').map((t: string) => {
            const m = t.match(/<([^>]+)>/);
            return m ? m[1].trim() : t.trim();
          });

          // Subject & Date
          const subject = headers['subject'] || '(No Subject)';
          const receivedAt = msg.internalDate
            ? new Date(Number(msg.internalDate))
            : new Date();

          // Labels
          const labelIds: string[] = msg.labelIds || [];
          const isRead = !labelIds.includes('UNREAD');
          const isFlagged = labelIds.includes('STARRED');

          // Body
          const { bodyText, bodyHtml } = this.parseMessagePayload(msg.payload || {});

          normalizedBatch.push({
            remoteId: msg.id,
            remoteThreadId: msg.threadId || msg.id,
            senderName,
            senderEmail,
            recipients,
            subject,
            snippet: msg.snippet || '',
            bodyText,
            bodyHtml,
            receivedAt,
            isRead,
            isFlagged,
            hasAttachments: Boolean(
              msg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
            ),
          });
        } catch (fetchMsgErr) {
          console.error(`[GmailAdapter] Failed to fetch message ${item.id}:`, fetchMsgErr);
        }
      }

      if (normalizedBatch.length > 0) {
        await onBatch(normalizedBatch);
      }

      return normalizedBatch.length;
    } catch (err) {
      console.error('[GmailAdapter] Sync error:', err);
      return 0;
    }
  }

  /**
   * Send mail directly via Gmail REST API
   */
  async sendMail(options: SendMailOptions): Promise<{ success: boolean; messageId: string }> {
    try {
      const boundary = `----=_Part_${Date.now()}`;
      const toHeader = options.to.join(', ');

      const lines = [
        `From: ${options.from}`,
        `To: ${toHeader}`,
        `Subject: =?utf-8?B?${Buffer.from(options.subject).toString('base64')}?=`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        options.bodyText || options.bodyHtml.replace(/<[^>]+>/g, ''),
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        options.bodyHtml,
        '',
        `--${boundary}--`,
      ];

      const rawMime = lines.join('\r\n');
      const base64UrlRaw = Buffer.from(rawMime)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await this.authenticatedFetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: base64UrlRaw }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gmail send error (${res.status}): ${body}`);
      }

      const data = (await res.json()) as any;
      return { success: true, messageId: data.id };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown Gmail send error';
      throw new Error(msg);
    }
  }

  async markAsRead(remoteMessageId: string, isRead: boolean): Promise<void> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${remoteMessageId}/modify`;
    await this.authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        removeLabelIds: isRead ? ['UNREAD'] : [],
        addLabelIds: !isRead ? ['UNREAD'] : [],
      }),
    });
  }

  async archiveMessage(remoteMessageId: string): Promise<void> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${remoteMessageId}/modify`;
    await this.authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        removeLabelIds: ['INBOX'],
      }),
    });
  }

  async deleteMessage(remoteMessageId: string): Promise<void> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${remoteMessageId}/trash`;
    await this.authenticatedFetch(url, {
      method: 'POST',
    });
  }

  async disconnect(): Promise<void> {
    // No-op for REST stateless connection
  }
}
