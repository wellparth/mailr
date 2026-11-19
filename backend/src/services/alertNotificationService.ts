import prisma from '../db.js';
import { redis } from './redisClient.js';
import { decryptSecret } from '../utils/crypto.js';

export interface AlertThreadInfo {
  id: string;
  subject: string;
  priorityScore: number;
  priorityLevel: string;
  priorityReason?: string | null;
  snippet?: string | null;
}

export interface AlertMessageInfo {
  id: string;
  senderName?: string | null;
  senderEmail: string;
  snippet?: string | null;
  receivedAt: Date | string;
}

export class AlertNotificationService {
  /**
   * Evaluates inbound message priority and dispatches push alerts to Telegram Bot and/or Discord Webhook.
   */
  static async sendUrgentAlert(
    userId: string,
    thread: AlertThreadInfo,
    message: AlertMessageInfo
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          alertsEnabled: true,
          alertThreshold: true,
          telegramBotToken: true,
          telegramChatId: true,
          discordWebhookUrl: true,
        },
      });

      if (!user || !user.alertsEnabled) return;

      const threshold = user.alertThreshold || 'URGENT';
      const level = thread.priorityLevel?.toUpperCase() || 'NORMAL';

      // Check priority threshold
      if (threshold === 'URGENT' && level !== 'URGENT') return;
      if (threshold === 'HIGH' && level !== 'URGENT' && level !== 'HIGH') return;

      // Rate limit / Deduplicate: Max 1 alert per thread every 10 minutes to prevent spam loops
      const dedupKey = `mailr:alert:dedup:${userId}:${thread.id}`;
      try {
        const alreadyAlerted = await redis.get(dedupKey);
        if (alreadyAlerted) {
          return;
        }
        await redis.set(dedupKey, '1', 600); // 10 minutes TTL
      } catch {}

      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      const deepLink = `${appUrl}/app?threadId=${thread.id}`;
      const senderDisplay = message.senderName ? `${message.senderName} (${message.senderEmail})` : message.senderEmail;
      const previewText = (message.snippet || thread.snippet || '').trim().substring(0, 260);
      const isUrgent = level === 'URGENT';

      // 1. Dispatch to Discord Webhook
      if (user.discordWebhookUrl) {
        try {
          const webhookUrl = decryptSecret(user.discordWebhookUrl);
          await this.dispatchDiscordWebhook(webhookUrl, {
            isUrgent,
            level,
            subject: thread.subject,
            sender: senderDisplay,
            reason: thread.priorityReason || 'High priority message detected by Mailr AI',
            preview: previewText,
            deepLink,
            timestamp: new Date(message.receivedAt).toISOString(),
          });
        } catch (discordErr) {
          console.warn('[AlertNotificationService] Discord dispatch failed:', discordErr);
        }
      }

      // 2. Dispatch to Telegram Bot
      if (user.telegramBotToken && user.telegramChatId) {
        try {
          const botToken = decryptSecret(user.telegramBotToken);
          await this.dispatchTelegramMessage(botToken, user.telegramChatId, {
            isUrgent,
            level,
            subject: thread.subject,
            sender: senderDisplay,
            reason: thread.priorityReason || 'High priority message detected by Mailr AI',
            preview: previewText,
            deepLink,
          });
        } catch (tgErr) {
          console.warn('[AlertNotificationService] Telegram dispatch failed:', tgErr);
        }
      }
    } catch (err) {
      console.error('[AlertNotificationService] Error executing urgent alert:', err);
    }
  }

  /**
   * Formats and posts an embed notification to Discord Webhook.
   */
  private static async dispatchDiscordWebhook(
    webhookUrl: string,
    data: {
      isUrgent: boolean;
      level: string;
      subject: string;
      sender: string;
      reason: string;
      preview: string;
      deepLink: string;
      timestamp: string;
    }
  ): Promise<void> {
    const embedColor = data.isUrgent ? 0xef4444 : 0xf59e0b; // Red for URGENT, Amber for HIGH
    const emoji = data.isUrgent ? '🚨' : '⚡';

    const payload = {
      username: 'Mailr AI Dispatcher',
      avatar_url: 'https://raw.githubusercontent.com/wellparth/mailr/develop/public/icon.png',
      embeds: [
        {
          title: `${emoji} [${data.level}] ${data.subject}`,
          url: data.deepLink,
          color: embedColor,
          description: data.preview ? `*${data.preview}*` : undefined,
          fields: [
            { name: 'From', value: data.sender, inline: true },
            { name: 'Priority Level', value: data.level, inline: true },
            { name: 'AI Reason', value: data.reason, inline: false },
          ],
          footer: {
            text: 'Mailr Self-Hosted Email Agent • Click title to view thread',
          },
          timestamp: data.timestamp,
        },
      ],
      components: [
        {
          type: 1, // ACTION_ROW
          components: [
            {
              type: 2, // BUTTON
              style: 5, // LINK
              label: 'Open in Mailr',
              url: data.deepLink,
            },
          ],
        },
      ],
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Discord Webhook returned status ${res.status}: ${errText}`);
    }
  }

  /**
   * Formats and sends an HTML message via Telegram Bot API.
   */
  private static async dispatchTelegramMessage(
    botToken: string,
    chatId: string,
    data: {
      isUrgent: boolean;
      level: string;
      subject: string;
      sender: string;
      reason: string;
      preview: string;
      deepLink: string;
    }
  ): Promise<void> {
    const emoji = data.isUrgent ? '🚨' : '⚡';
    const escapeHtml = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const text = [
      `${emoji} <b>[${data.level}] Mailr Priority Inbound Alert</b>`,
      '',
      `<b>From:</b> ${escapeHtml(data.sender)}`,
      `<b>Subject:</b> ${escapeHtml(data.subject)}`,
      `<b>AI Assessment:</b> ${escapeHtml(data.reason)}`,
      '',
      data.preview ? `<blockquote>${escapeHtml(data.preview)}</blockquote>` : '',
      '',
      `🔗 <a href="${data.deepLink}">Open Conversation in Mailr</a>`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Telegram API error (${res.status}): ${(errData as any).description || res.statusText}`);
    }
  }

  /**
   * Test Telegram connection with a verification message.
   */
  static async testTelegram(botToken: string, chatId: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ <b>Mailr Urgent Alerts Test</b>\n\nYour Telegram Bot is configured successfully! You will receive instant notifications here when high-priority emails arrive.',
          parse_mode: 'HTML',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return {
          success: false,
          message: `Telegram test failed: ${(data as any).description || res.statusText}`,
        };
      }

      return {
        success: true,
        message: 'Telegram test message delivered successfully!',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown Telegram error',
      };
    }
  }

  /**
   * Test Discord webhook connection with a verification embed.
   */
  static async testDiscord(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'Mailr AI Dispatcher',
          embeds: [
            {
              title: '✅ Mailr Discord Alerts Connected',
              description: 'Your Discord channel webhook is successfully configured! You will receive high-priority and urgent email alerts here in real-time.',
              color: 0x10b981, // Emerald green
              timestamp: new Date().toISOString(),
              footer: { text: 'Mailr Self-Hosted Email Agent' },
            },
          ],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `Discord test failed (${res.status}): ${text}`,
        };
      }

      return {
        success: true,
        message: 'Discord test notification delivered successfully!',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown Discord webhook error',
      };
    }
  }
}
