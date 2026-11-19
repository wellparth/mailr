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
          slackWebhookUrl: true,
          whatsappWebhookUrl: true,
          customWebhookUrl: true,
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

      // 3. Dispatch to Slack Webhook
      if (user.slackWebhookUrl) {
        try {
          const slackUrl = decryptSecret(user.slackWebhookUrl);
          await this.dispatchSlackWebhook(slackUrl, {
            isUrgent,
            level,
            subject: thread.subject,
            sender: senderDisplay,
            reason: thread.priorityReason || 'High priority message detected by Mailr AI',
            preview: previewText,
            deepLink,
          });
        } catch (slackErr) {
          console.warn('[AlertNotificationService] Slack dispatch failed:', slackErr);
        }
      }

      // 4. Dispatch to WhatsApp / Mobile Custom Webhook
      const customUrlEnc = user.whatsappWebhookUrl || user.customWebhookUrl;
      if (customUrlEnc) {
        try {
          const customUrl = decryptSecret(customUrlEnc);
          await this.dispatchCustomWebhook(customUrl, {
            isUrgent,
            level,
            subject: thread.subject,
            sender: senderDisplay,
            reason: thread.priorityReason || 'High priority message detected by Mailr AI',
            preview: previewText,
            deepLink,
            timestamp: new Date(message.receivedAt).toISOString(),
          });
        } catch (customErr) {
          console.warn('[AlertNotificationService] Custom/WhatsApp webhook dispatch failed:', customErr);
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

  /**
   * Formats and posts an alert notification to Slack Incoming Webhook.
   */
  private static async dispatchSlackWebhook(
    webhookUrl: string,
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
    const payload = {
      text: `${emoji} [${data.level}] ${data.subject} from ${data.sender}`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} [${data.level}] Mailr Priority Inbound Alert`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*From:*\n${data.sender}` },
            { type: 'mrkdwn', text: `*Subject:*\n${data.subject}` },
            { type: 'mrkdwn', text: `*AI Assessment:*\n${data.reason}` },
          ],
        },
        data.preview
          ? {
              type: 'section',
              text: { type: 'mrkdwn', text: `> _${data.preview}_` },
            }
          : undefined,
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: { type: 'plain_text', text: 'Open in Mailr', emoji: true },
              url: data.deepLink,
              style: data.isUrgent ? 'danger' : 'primary',
            },
          ],
        },
      ].filter(Boolean),
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Slack Webhook returned status ${res.status}: ${errText}`);
    }
  }

  /**
   * Dispatches structured alert to a custom webhook (supports WhatsApp gateways, Pushover, ntfy, Zapier, Make).
   */
  private static async dispatchCustomWebhook(
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
    const payload = {
      event: 'mailr_priority_alert',
      priority: data.level,
      isUrgent: data.isUrgent,
      title: `[${data.level}] ${data.subject}`,
      message: `${data.sender}: ${data.subject}\n\n${data.preview}`,
      sender: data.sender,
      subject: data.subject,
      reason: data.reason,
      preview: data.preview,
      url: data.deepLink,
      timestamp: data.timestamp,
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Custom webhook returned status ${res.status}: ${errText}`);
    }
  }

  /**
   * Test Slack webhook connection with a verification message.
   */
  static async testSlack(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '✅ *Mailr Slack Alerts Connected*\nYour Slack incoming webhook is successfully configured! You will receive priority email alerts and agent pings here.',
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `Slack test failed (${res.status}): ${text}`,
        };
      }

      return {
        success: true,
        message: 'Slack test notification delivered successfully!',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown Slack webhook error',
      };
    }
  }

  /**
   * Test Custom / WhatsApp webhook connection.
   */
  static async testCustomWebhook(webhookUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'mailr_test',
          title: '✅ Mailr Mobile / Webhook Alert Test',
          message: 'Your custom webhook / WhatsApp endpoint is successfully verified and ready to receive Mailr notifications.',
          timestamp: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return {
          success: false,
          message: `Webhook test failed (${res.status}): ${text}`,
        };
      }

      return {
        success: true,
        message: 'Custom webhook test delivered successfully!',
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown webhook error',
      };
    }
  }

  /**
   * Direct Agent Ping: sends an immediate push message to configured channels (Telegram, Discord, Slack, WhatsApp/Webhook).
   */
  static async sendDirectPing(
    userId: string,
    payload: {
      title: string;
      message: string;
      priority?: 'normal' | 'high' | 'urgent';
      channel?: 'auto' | 'telegram' | 'discord' | 'slack' | 'whatsapp' | 'all';
      deepLink?: string;
    }
  ): Promise<{
    dispatched: boolean;
    channelsDispatched: string[];
    details: Record<string, string>;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        telegramBotToken: true,
        telegramChatId: true,
        discordWebhookUrl: true,
        slackWebhookUrl: true,
        whatsappWebhookUrl: true,
        customWebhookUrl: true,
      },
    });

    if (!user) {
      return { dispatched: false, channelsDispatched: [], details: { error: 'User not found' } };
    }

    const channelsDispatched: string[] = [];
    const details: Record<string, string> = {};
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const link = payload.deepLink || `${appUrl}/app`;
    const targetChannel = payload.channel || 'auto';
    const isUrgent = payload.priority === 'urgent';
    const level = (payload.priority || 'normal').toUpperCase();

    // 1. Telegram
    if ((targetChannel === 'auto' || targetChannel === 'telegram' || targetChannel === 'all') && user.telegramBotToken && user.telegramChatId) {
      try {
        const botToken = decryptSecret(user.telegramBotToken);
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: user.telegramChatId,
            text: `🔔 <b>${payload.title}</b>\n\n${payload.message}\n\n🔗 <a href="${link}">Open in Mailr</a>`,
            parse_mode: 'HTML',
          }),
        });
        if (res.ok) {
          channelsDispatched.push('telegram');
          details.telegram = 'Delivered to Telegram';
        } else {
          details.telegram = `Telegram response ${res.status}`;
        }
      } catch (tgErr: any) {
        details.telegram = `Telegram error: ${tgErr.message}`;
      }
    }

    // 2. Discord
    if ((targetChannel === 'auto' || targetChannel === 'discord' || targetChannel === 'all') && user.discordWebhookUrl) {
      try {
        const webhookUrl = decryptSecret(user.discordWebhookUrl);
        const res = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'Mailr AI Copilot',
            embeds: [
              {
                title: payload.title,
                url: link,
                description: payload.message,
                color: isUrgent ? 0xef4444 : 0x3b82f6,
                timestamp: new Date().toISOString(),
                footer: { text: 'Mailr Agent Ping' },
              },
            ],
          }),
        });
        if (res.ok) {
          channelsDispatched.push('discord');
          details.discord = 'Delivered to Discord';
        } else {
          details.discord = `Discord response ${res.status}`;
        }
      } catch (dcErr: any) {
        details.discord = `Discord error: ${dcErr.message}`;
      }
    }

    // 3. Slack
    if ((targetChannel === 'auto' || targetChannel === 'slack' || targetChannel === 'all') && user.slackWebhookUrl) {
      try {
        const slackUrl = decryptSecret(user.slackWebhookUrl);
        const res = await fetch(slackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🔔 *${payload.title}*\n${payload.message}\n<${link}|Open in Mailr>`,
          }),
        });
        if (res.ok) {
          channelsDispatched.push('slack');
          details.slack = 'Delivered to Slack';
        } else {
          details.slack = `Slack response ${res.status}`;
        }
      } catch (slErr: any) {
        details.slack = `Slack error: ${slErr.message}`;
      }
    }

    // 4. WhatsApp / Custom Webhook
    const customUrlEnc = user.whatsappWebhookUrl || user.customWebhookUrl;
    if ((targetChannel === 'auto' || targetChannel === 'whatsapp' || targetChannel === 'all') && customUrlEnc) {
      try {
        const customUrl = decryptSecret(customUrlEnc);
        const res = await fetch(customUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'mailr_agent_ping',
            title: payload.title,
            message: payload.message,
            priority: level,
            url: link,
            timestamp: new Date().toISOString(),
          }),
        });
        if (res.ok) {
          channelsDispatched.push('mobile_webhook');
          details.mobile_webhook = 'Delivered to WhatsApp/Custom Webhook';
        } else {
          details.mobile_webhook = `Custom webhook response ${res.status}`;
        }
      } catch (cwErr: any) {
        details.mobile_webhook = `Custom webhook error: ${cwErr.message}`;
      }
    }

    return {
      dispatched: channelsDispatched.length > 0,
      channelsDispatched,
      details,
    };
  }
}
