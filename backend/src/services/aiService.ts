import prisma from '../db.js';
import { PriorityLevel } from '@prisma/client';
import { redis } from './redisClient.js';

export interface ParsedTriageAction {
  intent: 'ARCHIVE' | 'MARK_READ' | 'MARK_UNREAD' | 'FLAG' | 'UNFLAG' | 'SET_PRIORITY' | 'DELETE';
  filters: {
    senderDomain?: string;
    senderEmail?: string;
    keywords?: string[];
    olderThanDays?: number;
    unreadOnly?: boolean;
    priorityLevel?: PriorityLevel;
    accountEmail?: string;
  };
  summary: string;
}

export type EmailCategory =
  | 'ACTION_REQUIRED'
  | 'USEFUL_TRANSACTIONAL'
  | 'AUTOMATED_NO_REPLY'
  | 'NEWSLETTER'
  | 'PROMOTIONAL'
  | 'SPAM'
  | 'NOTIFICATION'
  | 'PRIMARY';

export interface PriorityAssessment {
  score: number;
  level: PriorityLevel;
  reason: string;
  category: EmailCategory;
  requiresReply: boolean;
  isNoReply: boolean;
  hasUsefulContent: boolean;
  usefulType?: 'VERIFICATION_2FA' | 'RECEIPT_BILLING' | 'TRAVEL_BOOKING' | 'SECURITY_ALERT';
}

export interface CleanupSuggestion {
  id: string;
  type: 'UNSUBSCRIBE' | 'ARCHIVE_NO_REPLY' | 'ARCHIVE_PROMOS' | 'REVIEW_REPLIES';
  title: string;
  description: string;
  badge: string;
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
  affectedCount: number;
  threadIds: string[];
  senderEmail?: string;
  unsubscribeUrl?: string;
  actionText: string;
}

export interface InboxHealthReport {
  accountId: string;
  accountEmail: string;
  healthScore: number;
  totalInboxThreads: number;
  unnecessaryCount: number;
  breakdown: {
    actionRequired: number;
    usefulTransactional: number;
    automatedNoReply: number;
    newsletters: number;
    promotional: number;
    spam: number;
    primary: number;
  };
  suggestions: CleanupSuggestion[];
}

export interface EmailClassification {
  threadId: string;
  messageId: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  snippet: string;
  category: EmailCategory;
  confidence: number;
  signals: string[];
  recommendedAction: 'ARCHIVE' | 'TRASH' | 'UNSUBSCRIBE' | 'KEEP';
  isUnnecessary: boolean;
  receivedAt: string;
}

export class AIService {
  /**
   * Parse a natural language triage command into a structured action.
   */
  static parseTriagePrompt(prompt: string): ParsedTriageAction {
    const lower = prompt.toLowerCase();

    let intent: ParsedTriageAction['intent'] = 'MARK_READ';
    if (lower.includes('archive')) intent = 'ARCHIVE';
    else if (lower.includes('delete') || lower.includes('trash')) intent = 'DELETE';
    else if (lower.includes('unread')) intent = 'MARK_UNREAD';
    else if (lower.includes('read')) intent = 'MARK_READ';
    else if (lower.includes('star') || lower.includes('flag')) intent = 'FLAG';
    else if (lower.includes('urgent') || lower.includes('priority')) intent = 'SET_PRIORITY';

    const filters: ParsedTriageAction['filters'] = {};

    // Domain detection (e.g. from github, from acme.com)
    const domainMatch = lower.match(/(?:from|by)\s+@?([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (domainMatch) {
      filters.senderDomain = domainMatch[1];
    } else if (lower.includes('github')) {
      filters.senderDomain = 'github.com';
    } else if (lower.includes('newsletter') || lower.includes('marketing')) {
      filters.keywords = ['newsletter', 'unsubscribe', 'digest', 'promo'];
    }

    // Days detection (e.g. older than 7 days, last 3 days)
    const daysMatch = lower.match(/(\d+)\s+days?/);
    if (daysMatch) {
      filters.olderThanDays = Math.min(Math.max(1, parseInt(daysMatch[1], 10) || 1), 3650);
    }

    if (lower.includes('unread')) {
      filters.unreadOnly = true;
    }

    if (intent === 'SET_PRIORITY') {
      filters.priorityLevel = PriorityLevel.URGENT;
    }

    return {
      intent,
      filters,
      summary: `Execute ${intent} on messages matching filters (${JSON.stringify(filters)})`,
    };
  }

  /**
   * Execute natural language triage across the user's connected mailboxes.
   */
  static async executeTriage(userId: string, prompt: string, accountId?: string) {
    const parsed = this.parseTriagePrompt(prompt);

    // Build Prisma query condition
    const whereCondition: Record<string, unknown> = {
      account: { userId },
      isArchived: false,
    };

    if (accountId && accountId !== 'all') {
      whereCondition.accountId = accountId;
    }

    if (parsed.filters.unreadOnly) {
      whereCondition.isRead = false;
    }

    if (parsed.filters.senderDomain) {
      whereCondition.senderEmail = {
        contains: `@${parsed.filters.senderDomain}`,
      };
    }

    if (parsed.filters.keywords && parsed.filters.keywords.length > 0) {
      whereCondition.OR = parsed.filters.keywords.map((kw) => ({
        OR: [
          { subject: { contains: kw } },
          { snippet: { contains: kw } },
        ],
      }));
    }

    if (parsed.filters.olderThanDays) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parsed.filters.olderThanDays);
      whereCondition.receivedAt = {
        lt: cutoffDate,
      };
    }

    // Fetch messages to be affected
    const messagesToUpdate = await prisma.message.findMany({
      where: whereCondition,
      select: { id: true, threadId: true },
    });

    const affectedCount = messagesToUpdate.length;
    const messageIds = messagesToUpdate.map((m) => m.id);
    const threadIds = Array.from(new Set(messagesToUpdate.map((m) => m.threadId)));

    if (affectedCount > 0) {
      switch (parsed.intent) {
        case 'ARCHIVE':
          await prisma.message.updateMany({
            where: { id: { in: messageIds } },
            data: { isArchived: true },
          });
          await prisma.thread.updateMany({
            where: { id: { in: threadIds } },
            data: { isArchived: true },
          });
          break;

        case 'MARK_READ':
          await prisma.message.updateMany({
            where: { id: { in: messageIds } },
            data: { isRead: true },
          });
          break;

        case 'MARK_UNREAD':
          await prisma.message.updateMany({
            where: { id: { in: messageIds } },
            data: { isRead: false },
          });
          break;

        case 'FLAG':
          await prisma.message.updateMany({
            where: { id: { in: messageIds } },
            data: { isFlagged: true },
          });
          await prisma.thread.updateMany({
            where: { id: { in: threadIds } },
            data: { isStarred: true },
          });
          break;

        case 'SET_PRIORITY':
          await prisma.thread.updateMany({
            where: { id: { in: threadIds } },
            data: {
              priorityLevel: PriorityLevel.URGENT,
              priorityScore: 95,
              priorityReason: 'Manually marked as urgent via AI triage command',
            },
          });
          break;

        case 'DELETE':
          await prisma.message.deleteMany({
            where: { id: { in: messageIds } },
          });
          break;
      }
    }

    // Record audit log
    await prisma.aITriageLog.create({
      data: {
        userId,
        naturalLanguagePrompt: prompt,
        parsedAction: JSON.parse(JSON.stringify(parsed)),
        affectedCount,
      },
    });

    return {
      success: true,
      affectedCount,
      parsedAction: parsed,
      message: `Processed "${prompt}": updated ${affectedCount} message(s).`,
    };
  }

  /**
   * Score priority and categorize an email thread.
   * Differentiates automated no-reply emails: flags as low-priority noise unless the
   * content is genuinely useful (2FA verification, invoice receipt, flight booking, security alert).
   */
  static calculatePriority(
    subject: string,
    snippet: string,
    senderEmail: string,
    unsubscribeUrl?: string | null,
    isNewsletter?: boolean
  ): PriorityAssessment {
    const text = `${subject || ''} ${snippet || ''}`.toLowerCase();
    const sender = (senderEmail || '').toLowerCase();

    // 1. Detect if sender is an automated no-reply bot/system
    const isNoReply =
      sender.includes('noreply') ||
      sender.includes('no-reply') ||
      sender.includes('donotreply') ||
      sender.includes('do-not-reply') ||
      sender.includes('notifications@') ||
      sender.includes('notification@') ||
      sender.includes('mailer-daemon') ||
      sender.includes('system@') ||
      sender.includes('alert@') ||
      sender.includes('alerts@') ||
      sender.includes('automated@') ||
      sender.includes('bounce@') ||
      sender.includes('service@') ||
      sender.includes('updates@') ||
      text.includes('do not reply to this email') ||
      text.includes('this is an automated message') ||
      text.includes('this email was sent from a notification-only address');

    // 2. Detect if content contains genuinely useful transactional/security info
    const hasVerificationCode =
      /\b\d{4,8}\b/.test(text) &&
      (text.includes('verification code') ||
        text.includes('security code') ||
        text.includes('one-time password') ||
        text.includes('otp') ||
        text.includes('confirm your email') ||
        text.includes('login code') ||
        text.includes('password reset') ||
        text.includes('temporary password') ||
        text.includes('authorization code'));

    const isCriticalSecurityAlert =
      text.includes('security alert') ||
      text.includes('new sign-in') ||
      text.includes('suspicious activity') ||
      text.includes('account recovery') ||
      text.includes('unauthorized access') ||
      text.includes('password changed');

    const isReceiptOrBilling =
      text.includes('receipt for') ||
      text.includes('your receipt') ||
      text.includes('order confirmation') ||
      text.includes('order #') ||
      text.includes('invoice #') ||
      text.includes('invoice attached') ||
      text.includes('payment received') ||
      text.includes('payment confirmation') ||
      text.includes('subscription renewed') ||
      text.includes('tracking number') ||
      text.includes('package has been delivered') ||
      text.includes('out for delivery') ||
      text.includes('statement is ready') ||
      text.includes('refund processed');

    const isTravelOrBooking =
      text.includes('flight confirmation') ||
      text.includes('boarding pass') ||
      text.includes('hotel reservation') ||
      text.includes('booking reference') ||
      text.includes('itinerary for your trip') ||
      text.includes('e-ticket') ||
      text.includes('check-in is open');

    const hasUsefulContent = hasVerificationCode || isCriticalSecurityAlert || isReceiptOrBilling || isTravelOrBooking;
    let usefulType: PriorityAssessment['usefulType'] = undefined;
    if (hasVerificationCode) usefulType = 'VERIFICATION_2FA';
    else if (isCriticalSecurityAlert) usefulType = 'SECURITY_ALERT';
    else if (isReceiptOrBilling) usefulType = 'RECEIPT_BILLING';
    else if (isTravelOrBooking) usefulType = 'TRAVEL_BOOKING';

    // 3. Evaluate No-Reply Senders with Useful vs Unuseful Filter
    if (isNoReply) {
      if (hasUsefulContent) {
        let reason = 'Useful automated notice (no response needed).';
        if (hasVerificationCode) reason = 'Contains 2FA / verification security code.';
        else if (isReceiptOrBilling) reason = 'Payment receipt / order confirmation.';
        else if (isTravelOrBooking) reason = 'Travel booking / itinerary confirmation.';
        else if (isCriticalSecurityAlert) reason = 'Critical security / account alert.';

        const score = isCriticalSecurityAlert || hasVerificationCode ? 85 : 75;
        return {
          score,
          level: score >= 80 ? PriorityLevel.HIGH : PriorityLevel.NORMAL,
          reason,
          category: 'USEFUL_TRANSACTIONAL',
          requiresReply: false,
          isNoReply: true,
          hasUsefulContent: true,
          usefulType,
        };
      }

      // Check if it's promotional or newsletter from a no-reply address
      if (text.includes('% off') || text.includes('discount') || text.includes('sale') || text.includes('deal')) {
        return {
          score: 20,
          level: PriorityLevel.LOW,
          reason: 'Automated promotional marketing blast.',
          category: 'PROMOTIONAL',
          requiresReply: false,
          isNoReply: true,
          hasUsefulContent: false,
        };
      }

      if (isNewsletter || Boolean(unsubscribeUrl) || text.includes('unsubscribe') || text.includes('digest')) {
        return {
          score: 25,
          level: PriorityLevel.LOW,
          reason: 'Automated newsletter / publication digest.',
          category: 'NEWSLETTER',
          requiresReply: false,
          isNoReply: true,
          hasUsefulContent: false,
        };
      }

      // Routine unuseful no-reply notice
      return {
        score: 20,
        level: PriorityLevel.LOW,
        reason: 'Automated no-reply notification • No action or reply needed.',
        category: 'AUTOMATED_NO_REPLY',
        requiresReply: false,
        isNoReply: true,
        hasUsefulContent: false,
      };
    }

    // 4. Check for Spam / Phishing
    const spamKeywords = [
      'crypto wallet', 'wire transfer', 'lottery winner', 'inheritance fund',
      'verify your wallet', 'western union', 'bitcoin deposit', 'eth transfer',
      'claim your prize', 'congratulations you won', 'foreign beneficiary',
      'million dollars transfer',
    ];
    if (spamKeywords.some((kw) => text.includes(kw))) {
      return {
        score: 5,
        level: PriorityLevel.LOW,
        reason: 'Suspected spam or high-risk solicitation.',
        category: 'SPAM',
        requiresReply: false,
        isNoReply: false,
        hasUsefulContent: false,
      };
    }

    // 5. Check for Promotional Emails
    const promoKeywords = [
      '% off', 'percent off', 'discount code', 'coupon code', 'promo code',
      'flash sale', 'clearance', 'black friday', 'limited time offer',
      'special offer', 'save up to', 'exclusive pricing', 'shop now and save',
    ];
    const isPromoSender =
      sender.includes('promo') ||
      sender.includes('deals@') ||
      sender.includes('offers@') ||
      sender.includes('marketing@') ||
      sender.includes('store@') ||
      sender.includes('sales@');
    if (promoKeywords.some((kw) => text.includes(kw)) || isPromoSender) {
      return {
        score: 20,
        level: PriorityLevel.LOW,
        reason: 'Promotional campaign or sales advertisement.',
        category: 'PROMOTIONAL',
        requiresReply: false,
        isNoReply: false,
        hasUsefulContent: false,
      };
    }

    // 6. Check for Newsletters
    if (
      isNewsletter ||
      Boolean(unsubscribeUrl) ||
      sender.includes('newsletter') ||
      sender.includes('substack.com') ||
      sender.includes('medium.com') ||
      text.includes('weekly digest') ||
      text.includes('monthly roundup') ||
      text.includes('you received this email because you subscribed')
    ) {
      return {
        score: 25,
        level: PriorityLevel.LOW,
        reason: 'Curated publication or periodic newsletter.',
        category: 'NEWSLETTER',
        requiresReply: false,
        isNoReply: false,
        hasUsefulContent: false,
      };
    }

    // 7. Check for Direct Human Correspondence Requiring Action / Reply
    const isUrgent =
      text.includes('urgent') ||
      text.includes('asap') ||
      text.includes('critical') ||
      text.includes('action required') ||
      text.includes('immediate attention') ||
      text.includes('emergency') ||
      text.includes('deadline today');

    const asksQuestionOrAction =
      text.includes('?') ||
      text.includes('please let me know') ||
      text.includes('can you') ||
      text.includes('could you') ||
      text.includes('waiting on your') ||
      text.includes('feedback on') ||
      text.includes('what do you think') ||
      text.includes('are you free') ||
      text.includes('meeting request') ||
      text.includes('proposal') ||
      text.includes('contract') ||
      text.includes('review attached');

    if (asksQuestionOrAction || isUrgent) {
      const score = isUrgent ? 95 : 85;
      return {
        score,
        level: isUrgent ? PriorityLevel.URGENT : PriorityLevel.HIGH,
        reason: isUrgent
          ? 'Urgent direct inquiry with immediate action required.'
          : 'Direct correspondence requesting your review or reply.',
        category: 'ACTION_REQUIRED',
        requiresReply: true,
        isNoReply: false,
        hasUsefulContent: true,
      };
    }

    // 8. Standard Primary FYI Correspondence
    return {
      score: 50,
      level: PriorityLevel.NORMAL,
      reason: 'Direct human correspondence (for your information).',
      category: 'PRIMARY',
      requiresReply: false,
      isNoReply: false,
      hasUsefulContent: true,
    };
  }

  /**
   * High-accuracy classifier to distinguish promotional, spam, newsletter, and notification emails.
   */
  static classifyEmail(message: {
    threadId: string;
    id: string;
    senderEmail: string;
    senderName?: string | null;
    subject: string;
    snippet?: string | null;
    bodyText?: string | null;
    unsubscribeUrl?: string | null;
    isNewsletter?: boolean;
    receivedAt: Date | string;
  }): EmailClassification {
    const text = `${message.subject || ''} ${message.snippet || ''} ${message.bodyText ? message.bodyText.substring(0, 500) : ''}`.toLowerCase();
    const sender = (message.senderEmail || '').toLowerCase();
    const subject = (message.subject || '').toLowerCase();
    const signals: string[] = [];

    // 1. SPAM / PHISHING / MALICIOUS DETECTION
    const spamKeywords = [
      'crypto wallet', 'wire transfer', 'lottery winner', 'inheritance fund',
      'verify your wallet', 'western union', 'bitcoin deposit', 'eth transfer',
      'urgent account suspended', 'claim your prize', 'congratulations you won',
      'transfer your funds', 'foreign beneficiary', 'dear beneficiary',
      'million dollars transfer', 'act immediately or account deleted',
    ];
    const detectedSpam = spamKeywords.filter((kw) => text.includes(kw));
    if (detectedSpam.length > 0 || (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(sender) && (sender.includes('lottery') || sender.includes('sweepstakes') || sender.includes('prize')))) {
      signals.push(`High-risk spam/phishing phrases detected: "${detectedSpam.join('", "')}"`);
      return {
        threadId: message.threadId,
        messageId: message.id,
        senderEmail: message.senderEmail,
        senderName: message.senderName || undefined,
        subject: message.subject,
        snippet: message.snippet || '',
        category: 'SPAM',
        confidence: 95,
        signals,
        recommendedAction: 'TRASH',
        isUnnecessary: true,
        receivedAt: new Date(message.receivedAt).toISOString(),
      };
    }

    // 2. PROMOTIONAL / SALES DEALS / MARKETING CAMPAIGNS
    const promoKeywords = [
      '% off', 'percent off', 'discount', 'coupon code', 'promo code',
      'voucher code', 'flash sale', 'sale ends', 'clearance', 'black friday',
      'cyber monday', 'special offer', 'limited time offer', 'free shipping',
      'exclusive deal', 'deal of the day', 'save up to', 'exclusive pricing',
      'upgrade now for $', 'shop now', 'buy now and save', 'don\'t miss out on this deal',
      'seasonal sale', 'order today and save', 'holiday discount', 'early bird discount',
    ];
    const detectedPromo = promoKeywords.filter((kw) => text.includes(kw));
    const isPromotionalSender =
      sender.includes('promo') ||
      sender.includes('deals@') ||
      sender.includes('marketing@') ||
      sender.includes('offers@') ||
      sender.includes('sales@') ||
      sender.includes('store@') ||
      sender.includes('rewards@') ||
      sender.includes('discount@');

    if (detectedPromo.length > 0 || isPromotionalSender) {
      if (detectedPromo.length > 0) {
        signals.push(`Marketing keywords: "${detectedPromo.slice(0, 3).join('", "')}"`);
      }
      if (isPromotionalSender) {
        signals.push(`Promotional sender address: <${sender}>`);
      }
      return {
        threadId: message.threadId,
        messageId: message.id,
        senderEmail: message.senderEmail,
        senderName: message.senderName || undefined,
        subject: message.subject,
        snippet: message.snippet || '',
        category: 'PROMOTIONAL',
        confidence: detectedPromo.length > 1 ? 92 : 85,
        signals,
        recommendedAction: 'ARCHIVE',
        isUnnecessary: true,
        receivedAt: new Date(message.receivedAt).toISOString(),
      };
    }

    // 3. NEWSLETTER / DIGEST
    const isNewsletterSender =
      message.isNewsletter ||
      Boolean(message.unsubscribeUrl) ||
      sender.includes('newsletter') ||
      sender.includes('substack.com') ||
      sender.includes('medium.com') ||
      sender.includes('digest@');

    const newsletterPhrases = [
      'unsubscribe', 'view in browser', 'manage your preferences',
      'opt-out', 'weekly digest', 'monthly roundup', 'curated edition',
      'you received this email because you subscribed',
    ];
    const detectedNewsletter = newsletterPhrases.filter((kw) => text.includes(kw));

    if (isNewsletterSender || detectedNewsletter.length >= 2) {
      if (message.unsubscribeUrl || detectedNewsletter.includes('unsubscribe')) {
        signals.push('Contains 1-click unsubscribe header/links');
      }
      if (isNewsletterSender) {
        signals.push('Publication or digest platform sender');
      }
      if (detectedNewsletter.length > 0) {
        signals.push(`Newsletter signals: "${detectedNewsletter.slice(0, 2).join('", "')}"`);
      }
      return {
        threadId: message.threadId,
        messageId: message.id,
        senderEmail: message.senderEmail,
        senderName: message.senderName || undefined,
        subject: message.subject,
        snippet: message.snippet || '',
        category: 'NEWSLETTER',
        confidence: 88,
        signals,
        recommendedAction: 'ARCHIVE',
        isUnnecessary: true,
        receivedAt: new Date(message.receivedAt).toISOString(),
      };
    }

    // 4. AUTOMATED NOTIFICATION / TRANSACTIONAL ALERTS
    const isNotificationSender =
      sender.includes('noreply') ||
      sender.includes('no-reply') ||
      sender.includes('notifications@') ||
      sender.includes('mailer-daemon') ||
      sender.includes('system@') ||
      sender.includes('alert@') ||
      sender.includes('github.com') ||
      sender.includes('jira') ||
      sender.includes('zendesk');

    const notificationPhrases = [
      'password changed', 'login notification', 'security code',
      'build completed', 'pull request', 'automated notification',
      'do not reply to this email', 'receipt for your payment',
    ];
    const detectedNotification = notificationPhrases.filter((kw) => text.includes(kw));

    if (isNotificationSender || detectedNotification.length > 0) {
      signals.push(`Automated bot/system sender: <${sender}>`);
      if (detectedNotification.length > 0) {
        signals.push(`Transactional notice: "${detectedNotification.slice(0, 2).join('", "')}"`);
      }
      return {
        threadId: message.threadId,
        messageId: message.id,
        senderEmail: message.senderEmail,
        senderName: message.senderName || undefined,
        subject: message.subject,
        snippet: message.snippet || '',
        category: 'NOTIFICATION',
        confidence: 82,
        signals,
        recommendedAction: 'ARCHIVE',
        isUnnecessary: true,
        receivedAt: new Date(message.receivedAt).toISOString(),
      };
    }

    // 5. PRIMARY CORRESPONDENCE (High importance / personal / business)
    return {
      threadId: message.threadId,
      messageId: message.id,
      senderEmail: message.senderEmail,
      senderName: message.senderName || undefined,
      subject: message.subject,
      snippet: message.snippet || '',
      category: 'PRIMARY',
      confidence: 90,
      signals: ['Direct human correspondence, client inquiry, or work request'],
      recommendedAction: 'KEEP',
      isUnnecessary: false,
      receivedAt: new Date(message.receivedAt).toISOString(),
    };
  }

  /**
   * Scan, distinguish, and categorize emails across user mailboxes.
   */
  static async detectAndClassifyInbox(
    userId: string,
    options: {
      categoryFilter?: 'all' | 'promotional' | 'spam' | 'newsletter' | 'notification' | 'unnecessary';
      limit?: number;
      folder?: string;
    } = {}
  ) {
    const limit = Math.min(Math.max(options.limit || 40, 5), 100);
    const cacheKey = `mailr:ai:classified:${userId}:${options.categoryFilter || 'all'}:${limit}`;

    try {
      const cached = await redis.get<any>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch {}

    const where: any = {
      account: { userId },
      isArchived: false,
    };

    const messages = await prisma.message.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        threadId: true,
        senderEmail: true,
        senderName: true,
        subject: true,
        snippet: true,
        bodyText: true,
        unsubscribeUrl: true,
        isNewsletter: true,
        receivedAt: true,
      },
    });

    const classified: EmailClassification[] = messages.map((m) => this.classifyEmail(m));

    const promotional = classified.filter((c) => c.category === 'PROMOTIONAL');
    const spam = classified.filter((c) => c.category === 'SPAM');
    const newsletter = classified.filter((c) => c.category === 'NEWSLETTER');
    const notification = classified.filter((c) => c.category === 'NOTIFICATION');
    const primary = classified.filter((c) => c.category === 'PRIMARY');
    const unnecessary = classified.filter((c) => c.isUnnecessary);

    let filtered = classified;
    if (options.categoryFilter === 'promotional') filtered = promotional;
    else if (options.categoryFilter === 'spam') filtered = spam;
    else if (options.categoryFilter === 'newsletter') filtered = newsletter;
    else if (options.categoryFilter === 'notification') filtered = notification;
    else if (options.categoryFilter === 'unnecessary') filtered = unnecessary;

    const result = {
      totalScanned: messages.length,
      unnecessaryCount: unnecessary.length,
      breakdown: {
        promotional: promotional.length,
        spam: spam.length,
        newsletter: newsletter.length,
        notification: notification.length,
        primary: primary.length,
      },
      filteredCount: filtered.length,
      emails: filtered,
    };

    try {
      await redis.set(cacheKey, result, 600); // 10 minutes cache
    } catch {}

    return result;
  }

  /**
   * Extract calendar booking intent and details from an email message.
   */
  static extractCalendarProposal(messageText: string, messageSubject: string, senderEmail: string) {
    const lower = messageText.toLowerCase();

    // Check for meeting intent
    const hasIntent =
      lower.includes('meet') ||
      lower.includes('schedule') ||
      lower.includes('calendar') ||
      lower.includes('call') ||
      lower.includes('sync') ||
      lower.includes('zoom') ||
      lower.includes('google meet') ||
      lower.includes('discuss');

    if (!hasIntent) return null;

    // Detect approximate time / day
    const now = new Date();
    const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to tomorrow
    startTime.setHours(15, 0, 0, 0); // 3:00 PM default
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 mins

    return {
      title: `Meeting: ${messageSubject.replace(/^(re:\s*|fwd:\s*)/i, '').trim()}`,
      description: `Discussion regarding "${messageSubject}" with ${senderEmail}. Extracted automatically by Mailr AI.`,
      startTime,
      endTime,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      attendees: [{ email: senderEmail, name: senderEmail.split('@')[0] }],
    };
  }

  /**
   * Generate RFC 5545 iCalendar (.ics) content for an extracted event.
   */
  static generateICS(event: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
    attendees: { email: string; name?: string }[];
  }): string {
    const formatDate = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0] + 'Z';

    const uid = `mailr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}@mailr.app`;
    // Sanitize CRLF to prevent RFC 5545 iCalendar property injection
    const safeTitle = (event.title || '').replace(/[\r\n]+/g, ' ').trim();
    const safeDescription = (event.description || '').replace(/\r?\n/g, '\\n').replace(/[\r\n]/g, '');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Mailr Inc//Mailr AI Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${formatDate(new Date())}`,
      `DTSTART:${formatDate(new Date(event.startTime))}`,
      `DTEND:${formatDate(new Date(event.endTime))}`,
      `SUMMARY:${safeTitle}`,
      `DESCRIPTION:${safeDescription}`,
      `STATUS:CONFIRMED`,
      ...event.attendees.map((a) => {
        const safeName = (a.name || a.email || '').replace(/[\r\n]+/g, ' ').trim();
        const safeEmail = (a.email || '').replace(/[\r\n]+/g, '').trim();
        return `ATTENDEE;CN=${safeName};ROLE=REQ-PARTICIPANT:mailto:${safeEmail}`;
      }),
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }

  /**
   * AI assisted email drafter.
   */
  static generateDraftReply(subject: string, bodyText: string, tone: 'professional' | 'agree' | 'decline' | 'summary'): string {
    const cleanSubject = subject.replace(/^(re:\s*|fwd:\s*)/i, '').trim();

    switch (tone) {
      case 'agree':
        return `Hi there,\n\nThanks for reaching out regarding "${cleanSubject}". That sounds great to me. Let's proceed as discussed, and I will follow up with next steps shortly.\n\nBest regards,\nSent via Mailr`;
      case 'decline':
        return `Hello,\n\nThank you for the note on "${cleanSubject}". Unfortunately, my schedule is fully committed right now so I will have to pass on this occasion. I appreciate you keeping me in mind.\n\nWarm regards,\nSent via Mailr`;
      case 'summary':
        return `Key Takeaways from "${cleanSubject}":\n• Action item noted\n• Reviewing deliverables\n• Responding with requested materials by EOD.`;
      case 'professional':
      default:
        return `Hi,\n\nThank you for following up on "${cleanSubject}". I have reviewed the details and will get back to you with the finalized feedback before our next checkpoint.\n\nPlease let me know if anything urgent arises in the meantime.\n\nBest regards,\nSent via Mailr`;
    }
  }

  /**
   * Autonomous background worker: Audit and classify unclassified or existing threads across all inboxes.
   * Runs on the server even when the user is offline or not logged in.
   */
  static async auditAndClassifyExistingThreads(userId?: string): Promise<{ classifiedCount: number }> {
    const where: any = {
      isArchived: false,
      OR: [
        { aiCategory: null },
        { aiCategory: 'PRIMARY', priorityScore: 50 },
      ],
    };
    if (userId) {
      where.account = { userId };
    }

    const threads = await prisma.thread.findMany({
      where,
      take: 200,
      orderBy: { lastMessageAt: 'desc' },
      include: {
        messages: {
          take: 1,
          orderBy: { receivedAt: 'desc' },
          select: {
            senderEmail: true,
            subject: true,
            snippet: true,
            bodyText: true,
            unsubscribeUrl: true,
            isNewsletter: true,
          },
        },
      },
    });

    let classifiedCount = 0;
    for (const thread of threads) {
      const latest = thread.messages[0];
      if (!latest) continue;

      const assessment = this.calculatePriority(
        thread.subject,
        latest.snippet || latest.bodyText?.substring(0, 500) || '',
        latest.senderEmail,
        latest.unsubscribeUrl,
        latest.isNewsletter || thread.isNewsletter
      );

      await prisma.thread.update({
        where: { id: thread.id },
        data: {
          aiCategory: assessment.category,
          requiresReply: assessment.requiresReply,
          priorityScore: assessment.score,
          priorityLevel: assessment.level,
          priorityReason: assessment.reason,
          isNewsletter: thread.isNewsletter || assessment.category === 'NEWSLETTER',
        },
      });
      classifiedCount++;
    }

    return { classifiedCount };
  }

  /**
   * Generate intelligent clean-up suggestions per inbox or unified inbox.
   */
  static async getInboxCleanupReport(userId: string, accountId?: string): Promise<InboxHealthReport> {
    const where: any = {
      account: { userId },
      isArchived: false,
    };
    if (accountId && accountId !== 'all') {
      where.accountId = accountId;
    }

    // 1. Fetch all active inbox threads with latest message
    const threads = await prisma.thread.findMany({
      where,
      orderBy: { lastMessageAt: 'desc' },
      take: 500,
      include: {
        account: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
          },
        },
        messages: {
          take: 1,
          orderBy: { receivedAt: 'desc' },
          select: {
            id: true,
            senderEmail: true,
            senderName: true,
            unsubscribeUrl: true,
            bodyHtml: true,
            isRead: true,
          },
        },
      },
    });

    // 2. Breakdown counts
    let actionRequiredCount = 0;
    let usefulTransactionalCount = 0;
    let automatedNoReplyCount = 0;
    let newslettersCount = 0;
    let promotionalCount = 0;
    let spamCount = 0;
    let primaryCount = 0;

    const noReplyThreadIds: string[] = [];
    const promoThreadIds: string[] = [];
    const spamThreadIds: string[] = [];
    const actionRequiredThreadIds: string[] = [];

    // Group newsletters by sender for 1-click unsubscribe suggestions
    const newsletterSenderMap = new Map<string, {
      senderName: string;
      senderEmail: string;
      unsubscribeUrl?: string;
      threadIds: string[];
      unreadCount: number;
    }>();

    for (const t of threads) {
      const cat = t.aiCategory || 'PRIMARY';
      const latest = t.messages[0];
      const sender = latest?.senderEmail || '';

      switch (cat) {
        case 'ACTION_REQUIRED':
          actionRequiredCount++;
          actionRequiredThreadIds.push(t.id);
          break;
        case 'USEFUL_TRANSACTIONAL':
          usefulTransactionalCount++;
          break;
        case 'AUTOMATED_NO_REPLY':
          automatedNoReplyCount++;
          noReplyThreadIds.push(t.id);
          break;
        case 'NEWSLETTER':
          newslettersCount++;
          if (sender) {
            const existing = newsletterSenderMap.get(sender) || {
              senderName: latest?.senderName || sender.split('@')[0],
              senderEmail: sender,
              unsubscribeUrl: latest?.unsubscribeUrl || undefined,
              threadIds: [],
              unreadCount: 0,
            };
            existing.threadIds.push(t.id);
            if (!latest?.isRead) existing.unreadCount++;
            if (!existing.unsubscribeUrl && latest?.bodyHtml) {
              const match = latest.bodyHtml.match(/href=["'](https?:\/\/[^"']*(?:unsubscribe|optout|opt-out|preferences)[^"']*)["']/i);
              if (match) existing.unsubscribeUrl = match[1];
            }
            newsletterSenderMap.set(sender, existing);
          }
          break;
        case 'PROMOTIONAL':
          promotionalCount++;
          promoThreadIds.push(t.id);
          break;
        case 'SPAM':
          spamCount++;
          spamThreadIds.push(t.id);
          break;
        case 'PRIMARY':
        default:
          primaryCount++;
          break;
      }
    }

    const unnecessaryTotal = automatedNoReplyCount + newslettersCount + promotionalCount + spamCount;
    const healthScore = threads.length === 0
      ? 100
      : Math.max(10, Math.round(((threads.length - unnecessaryTotal) / threads.length) * 100));

    // 3. Formulate Actionable Clean-up Suggestions
    const suggestions: CleanupSuggestion[] = [];

    // Suggestion A: Specific Unsubscribe recommendations
    for (const [senderEmail, group] of newsletterSenderMap.entries()) {
      if (group.threadIds.length >= 1) {
        suggestions.push({
          id: `unsub_${Buffer.from(senderEmail).toString('hex').substring(0, 16)}`,
          type: 'UNSUBSCRIBE',
          title: `Unsubscribe from ${group.senderName || senderEmail}`,
          description: `${group.threadIds.length} email(s) in inbox (${group.unreadCount} unread). Unsubscribe & clean from inbox.`,
          badge: 'Newsletter',
          badgeVariant: 'secondary',
          affectedCount: group.threadIds.length,
          threadIds: group.threadIds,
          senderEmail,
          unsubscribeUrl: group.unsubscribeUrl,
          actionText: group.unsubscribeUrl ? 'Unsubscribe & Archive' : 'Archive All from Sender',
        });
      }
    }

    // Suggestion B: Automated No-Reply bulk clean
    if (noReplyThreadIds.length > 0) {
      suggestions.push({
        id: `archive_no_reply_${accountId || 'all'}`,
        type: 'ARCHIVE_NO_REPLY',
        title: `Archive ${noReplyThreadIds.length} No-Reply Notifications`,
        description: 'Automated robot notifications and routine system pings that need no response.',
        badge: 'Automated Bot',
        badgeVariant: 'outline',
        affectedCount: noReplyThreadIds.length,
        threadIds: noReplyThreadIds,
        actionText: 'Archive All No-Reply',
      });
    }

    // Suggestion C: Promotional marketing sweep
    if (promoThreadIds.length > 0) {
      suggestions.push({
        id: `archive_promos_${accountId || 'all'}`,
        type: 'ARCHIVE_PROMOS',
        title: `Clean ${promoThreadIds.length} Promotional Campaigns`,
        description: 'Coupons, store discounts, and advertising blasts taking up space.',
        badge: 'Promotions',
        badgeVariant: 'secondary',
        affectedCount: promoThreadIds.length,
        threadIds: promoThreadIds,
        actionText: 'Archive All Promos',
      });
    }

    // Suggestion D: Action items waiting on you
    if (actionRequiredThreadIds.length > 0) {
      suggestions.push({
        id: `review_replies_${accountId || 'all'}`,
        type: 'REVIEW_REPLIES',
        title: `${actionRequiredThreadIds.length} Conversations Awaiting Your Reply`,
        description: 'Direct human correspondence with unanswered questions or tasks.',
        badge: 'Reply Needed',
        badgeVariant: 'default',
        affectedCount: actionRequiredThreadIds.length,
        threadIds: actionRequiredThreadIds,
        actionText: 'Focus on Replies',
      });
    }

    return {
      accountId: accountId || 'all',
      accountEmail: accountId && accountId !== 'all' ? (threads[0]?.account?.emailAddress || accountId) : 'All Connected Inboxes',
      healthScore,
      totalInboxThreads: threads.length,
      unnecessaryCount: unnecessaryTotal,
      breakdown: {
        actionRequired: actionRequiredCount,
        usefulTransactional: usefulTransactionalCount,
        automatedNoReply: automatedNoReplyCount,
        newsletters: newslettersCount,
        promotional: promotionalCount,
        spam: spamCount,
        primary: primaryCount,
      },
      suggestions,
    };
  }

  /**
   * Execute 1-click clean-up actions on inbox threads (archive, trash, or unsubscribe).
   */
  static async executeInboxCleanup(
    userId: string,
    payload: {
      action: 'UNSUBSCRIBE_AND_ARCHIVE' | 'ARCHIVE' | 'TRASH';
      threadIds: string[];
      unsubscribeUrl?: string;
    }
  ) {
    const { action, threadIds, unsubscribeUrl } = payload;
    if (!threadIds || threadIds.length === 0) {
      return { success: true, affectedCount: 0, message: 'No threads selected for clean-up.' };
    }

    if (action === 'TRASH') {
      await prisma.message.deleteMany({
        where: { threadId: { in: threadIds }, account: { userId } },
      });
      await prisma.thread.deleteMany({
        where: { id: { in: threadIds }, account: { userId } },
      });
    } else {
      // Archive
      await prisma.thread.updateMany({
        where: { id: { in: threadIds }, account: { userId } },
        data: { isArchived: true },
      });
      await prisma.message.updateMany({
        where: { threadId: { in: threadIds }, account: { userId } },
        data: { isArchived: true },
      });
    }

    return {
      success: true,
      affectedCount: threadIds.length,
      action,
      unsubscribeUrl: unsubscribeUrl && /^https?:\/\//i.test(unsubscribeUrl) ? unsubscribeUrl : undefined,
      message: `Cleaned ${threadIds.length} thread(s) from inbox.`,
    };
  }
}
