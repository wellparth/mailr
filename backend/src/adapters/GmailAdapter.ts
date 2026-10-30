import {
  IEmailAdapter,
  NormalizedMessage,
  NormalizedAttachment,
  SendMailOptions,
  TestConnectionResult,
  SyncOptions,
} from './EmailAdapter.js';

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

    if (res.status === 429 || res.status === 403) {
      const cloned = res.clone();
      const errText = await cloned.text();
      if (errText.includes('rateLimitExceeded') || errText.includes('Quota exceeded') || res.status === 429) {
        console.warn('[GmailAdapter] Quota rate limit noticed, pausing for 3s before retry...');
        await new Promise((r) => setTimeout(r, 3000));
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
   * Normalizes a raw Gmail API message object into NormalizedMessage
   */
  private normalizeGmailMessage(msg: any): NormalizedMessage {
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

    // Parse CC
    let cc: string[] | undefined;
    if (headers['cc']) {
      cc = headers['cc'].split(',').map((t: string) => {
        const m = t.match(/<([^>]+)>/);
        return m ? m[1].trim() : t.trim();
      });
    }

    // Subject & Date
    const subject = headers['subject'] || '(No Subject)';
    const receivedAt = msg.internalDate
      ? new Date(Number(msg.internalDate))
      : new Date();

    // Labels
    const labelIds: string[] = msg.labelIds || [];
    const isRead = !labelIds.includes('UNREAD');
    const isFlagged = labelIds.includes('STARRED');
    const isArchived = !labelIds.includes('INBOX');

    // Body
    const { bodyText, bodyHtml } = this.parseMessagePayload(msg.payload || {});

    // Attachments
    const attachments: NormalizedAttachment[] = [];
    const extractAttachments = (part: any) => {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          contentType: part.mimeType || 'application/octet-stream',
          sizeBytes: part.body?.size || 0,
          filePath: part.body?.attachmentId || '',
        });
      }
      if (part.parts && Array.isArray(part.parts)) {
        part.parts.forEach(extractAttachments);
      }
    };
    if (msg.payload?.parts) msg.payload.parts.forEach(extractAttachments);

    return {
      remoteId: msg.id,
      remoteThreadId: msg.threadId || msg.id,
      senderName,
      senderEmail,
      recipients,
      cc,
      subject,
      snippet: msg.snippet || '',
      bodyText,
      bodyHtml,
      receivedAt,
      isRead,
      isFlagged,
      isArchived,
      hasAttachments: attachments.length > 0 || Boolean(
        msg.payload?.parts?.some((p: any) => p.filename && p.filename.length > 0)
      ),
      attachments: attachments.length > 0 ? attachments : undefined,
    };
  }

  /**
   * Sync inbox messages directly from Gmail REST API with pagination and high-throughput chunking
   */
  async syncMessages(
    _since: Date,
    onBatch: (messages: NormalizedMessage[]) => Promise<void>,
    options?: SyncOptions
  ): Promise<number> {
    try {
      const maxTarget = options?.maxMessages || (options?.fullSync ? 1000 : 300);
      const query = options?.folder ? `in:${options.folder}` : 'in:inbox';
      const allRawItems: Array<{ id: string; threadId: string }> = [];
      let pageToken: string | undefined = undefined;

      console.log(`[GmailAdapter] Starting sync for ${this.userEmail}: target=${maxTarget}, query=${query}`);

      // 1. Fetch message IDs via pagination loop
      while (allRawItems.length < maxTarget) {
        const remaining = maxTarget - allRawItems.length;
        const pageSize = Math.min(remaining, 100);
        let listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${pageSize}&q=${encodeURIComponent(query)}`;
        if (pageToken) {
          listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const listRes = await this.authenticatedFetch(listUrl);
        if (!listRes.ok) {
          const body = await listRes.text();
          console.warn(`[GmailAdapter] Message list error (${listRes.status}):`, body);
          break;
        }

        const listData = (await listRes.json()) as any;
        const pageItems = listData.messages || [];
        if (pageItems.length === 0) {
          break;
        }

        allRawItems.push(...pageItems);
        pageToken = listData.nextPageToken;
        if (!pageToken) {
          break;
        }
      }

      // Filter out messages already ingested into database
      const uningestedItems = options?.existingRemoteIds
        ? allRawItems.filter((item) => !options.existingRemoteIds!.has(item.id))
        : allRawItems;

      console.log(
        `[GmailAdapter] Discovered ${allRawItems.length} messages in Gmail for ${this.userEmail} (${uningestedItems.length} new uningested). Ingesting in concurrent batches...`
      );

      if (uningestedItems.length === 0) {
        return 0;
      }

      let totalSynced = 0;
      const CHUNK_SIZE = 15;

      for (let i = 0; i < uningestedItems.length; i += CHUNK_SIZE) {
        const chunk = uningestedItems.slice(i, i + CHUNK_SIZE);
        const batchResults = await Promise.all(
          chunk.map(async (item) => {
            try {
              const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`;
              const msgRes = await this.authenticatedFetch(msgUrl);
              if (!msgRes.ok) return null;

              const msg = (await msgRes.json()) as any;
              return this.normalizeGmailMessage(msg);
            } catch (fetchMsgErr) {
              console.error(`[GmailAdapter] Failed to fetch message ${item.id}:`, fetchMsgErr);
              return null;
            }
          })
        );

        const validMessages = batchResults.filter((m): m is NormalizedMessage => m !== null);
        if (validMessages.length > 0) {
          await onBatch(validMessages);
          totalSynced += validMessages.length;
          console.log(`[GmailAdapter] Ingested chunk: ${totalSynced}/${uningestedItems.length} messages processed`);
        }

        // 250ms smoothing delay to remain well within Google Cloud per-minute user quotas
        if (i + CHUNK_SIZE < uningestedItems.length) {
          await new Promise((r) => setTimeout(r, 250));
        }
      }

      return totalSynced;
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
