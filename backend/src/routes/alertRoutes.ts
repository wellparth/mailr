import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { AlertNotificationService } from '../services/alertNotificationService.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const router = Router();
router.use(authMiddleware);

// 1. Get alert settings
router.get('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
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

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    let discordMasked: string | null = null;
    if (user.discordWebhookUrl) {
      const raw = decryptSecret(user.discordWebhookUrl);
      discordMasked = raw.length > 20 ? raw.substring(0, 32) + '...' + raw.slice(-6) : '***';
    }

    let slackMasked: string | null = null;
    if (user.slackWebhookUrl) {
      const raw = decryptSecret(user.slackWebhookUrl);
      slackMasked = raw.length > 20 ? raw.substring(0, 32) + '...' + raw.slice(-6) : '***';
    }

    let customMasked: string | null = null;
    const customRawEnc = user.whatsappWebhookUrl || user.customWebhookUrl;
    if (customRawEnc) {
      const raw = decryptSecret(customRawEnc);
      customMasked = raw.length > 20 ? raw.substring(0, 32) + '...' + raw.slice(-6) : '***';
    }

    res.json({
      alertsEnabled: Boolean(user.alertsEnabled),
      alertThreshold: user.alertThreshold || 'URGENT',
      telegramChatId: user.telegramChatId || '',
      hasTelegramToken: Boolean(user.telegramBotToken),
      hasDiscordWebhook: Boolean(user.discordWebhookUrl),
      discordWebhookUrlMasked: discordMasked,
      hasSlackWebhook: Boolean(user.slackWebhookUrl),
      slackWebhookUrlMasked: slackMasked,
      hasCustomWebhook: Boolean(customRawEnc),
      customWebhookUrlMasked: customMasked,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error fetching alert configuration';
    res.status(500).json({ error: msg });
  }
});

// 2. Save alert settings
router.post('/config', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      alertsEnabled,
      alertThreshold,
      telegramBotToken,
      telegramChatId,
      discordWebhookUrl,
      slackWebhookUrl,
      whatsappWebhookUrl,
      customWebhookUrl,
    } = req.body;

    const updateData: Record<string, any> = {};

    if (typeof alertsEnabled === 'boolean') {
      updateData.alertsEnabled = alertsEnabled;
    }

    if (alertThreshold && ['URGENT', 'HIGH'].includes(alertThreshold.toUpperCase())) {
      updateData.alertThreshold = alertThreshold.toUpperCase();
    }

    if (telegramChatId !== undefined) {
      updateData.telegramChatId = telegramChatId ? String(telegramChatId).trim() : null;
    }

    if (telegramBotToken !== undefined) {
      if (telegramBotToken && telegramBotToken.trim().length > 0) {
        updateData.telegramBotToken = encryptSecret(telegramBotToken.trim());
      } else if (telegramBotToken === '') {
        updateData.telegramBotToken = null;
      }
    }

    if (discordWebhookUrl !== undefined) {
      if (discordWebhookUrl && discordWebhookUrl.trim().length > 0) {
        updateData.discordWebhookUrl = encryptSecret(discordWebhookUrl.trim());
      } else if (discordWebhookUrl === '') {
        updateData.discordWebhookUrl = null;
      }
    }

    if (slackWebhookUrl !== undefined) {
      if (slackWebhookUrl && slackWebhookUrl.trim().length > 0) {
        updateData.slackWebhookUrl = encryptSecret(slackWebhookUrl.trim());
      } else if (slackWebhookUrl === '') {
        updateData.slackWebhookUrl = null;
      }
    }

    const effectiveCustom = whatsappWebhookUrl !== undefined ? whatsappWebhookUrl : customWebhookUrl;
    if (effectiveCustom !== undefined) {
      if (effectiveCustom && effectiveCustom.trim().length > 0) {
        const enc = encryptSecret(effectiveCustom.trim());
        updateData.whatsappWebhookUrl = enc;
        updateData.customWebhookUrl = enc;
      } else if (effectiveCustom === '') {
        updateData.whatsappWebhookUrl = null;
        updateData.customWebhookUrl = null;
      }
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
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

    res.json({
      success: true,
      message: 'Urgent alert configuration updated successfully.',
      alertsEnabled: updated.alertsEnabled,
      alertThreshold: updated.alertThreshold,
      hasTelegramToken: Boolean(updated.telegramBotToken),
      hasDiscordWebhook: Boolean(updated.discordWebhookUrl),
      hasSlackWebhook: Boolean(updated.slackWebhookUrl),
      hasCustomWebhook: Boolean(updated.whatsappWebhookUrl || updated.customWebhookUrl),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error updating alert configuration';
    res.status(500).json({ error: msg });
  }
});

// 3. Test alert endpoint
router.post('/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { channel, telegramBotToken, telegramChatId, discordWebhookUrl, slackWebhookUrl, customWebhookUrl } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        telegramBotToken: true,
        telegramChatId: true,
        discordWebhookUrl: true,
        slackWebhookUrl: true,
        whatsappWebhookUrl: true,
        customWebhookUrl: true,
      },
    });

    if (channel === 'telegram') {
      const token = telegramBotToken
        ? telegramBotToken.trim()
        : user?.telegramBotToken
        ? decryptSecret(user.telegramBotToken)
        : null;

      const chatId = telegramChatId ? String(telegramChatId).trim() : user?.telegramChatId;

      if (!token || !chatId) {
        res.status(400).json({
          success: false,
          message: 'Both Telegram Bot Token and Chat ID are required to send a test message.',
        });
        return;
      }

      const result = await AlertNotificationService.testTelegram(token, chatId);
      res.json(result);
      return;
    } else if (channel === 'discord') {
      const webhook = discordWebhookUrl
        ? discordWebhookUrl.trim()
        : user?.discordWebhookUrl
        ? decryptSecret(user.discordWebhookUrl)
        : null;

      if (!webhook) {
        res.status(400).json({
          success: false,
          message: 'Discord Webhook URL is required to send a test embed.',
        });
        return;
      }

      const result = await AlertNotificationService.testDiscord(webhook);
      res.json(result);
      return;
    } else if (channel === 'slack') {
      const webhook = slackWebhookUrl
        ? slackWebhookUrl.trim()
        : user?.slackWebhookUrl
        ? decryptSecret(user.slackWebhookUrl)
        : null;

      if (!webhook) {
        res.status(400).json({
          success: false,
          message: 'Slack Webhook URL is required to send a test message.',
        });
        return;
      }

      const result = await AlertNotificationService.testSlack(webhook);
      res.json(result);
      return;
    } else if (channel === 'custom' || channel === 'whatsapp') {
      const webhook = customWebhookUrl
        ? customWebhookUrl.trim()
        : (user?.whatsappWebhookUrl || user?.customWebhookUrl)
        ? decryptSecret(user.whatsappWebhookUrl || user.customWebhookUrl!)
        : null;

      if (!webhook) {
        res.status(400).json({
          success: false,
          message: 'Webhook / WhatsApp URL is required to send a test message.',
        });
        return;
      }

      const result = await AlertNotificationService.testCustomWebhook(webhook);
      res.json(result);
      return;
    } else {
      res.status(400).json({
        success: false,
        message: 'Invalid channel specified. Choose "telegram", "discord", "slack", or "custom".',
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Alert test error';
    res.status(500).json({ success: false, message: msg });
  }
});

// 4. Direct Ping Endpoint
router.post('/ping', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { title, message, priority, channel, deepLink } = req.body;
    if (!title || !message) {
      res.status(400).json({ error: 'Title and message are required.' });
      return;
    }

    const result = await AlertNotificationService.sendDirectPing(req.user!.id, {
      title,
      message,
      priority: priority || 'normal',
      channel: channel || 'auto',
      deepLink,
    });

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ping error';
    res.status(500).json({ error: msg });
  }
});

export default router;
