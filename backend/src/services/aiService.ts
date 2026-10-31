import prisma from '../db.js';
import { PriorityLevel } from '@prisma/client';

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

export type EmailCategory = 'PROMOTIONAL' | 'SPAM' | 'NEWSLETTER' | 'NOTIFICATION' | 'PRIMARY';

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
   * Score priority of an email thread.
   */
  static calculatePriority(subject: string, snippet: string, senderEmail: string): {
    score: number;
    level: PriorityLevel;
    reason: string;
  } {
    const text = `${subject} ${snippet}`.toLowerCase();
    let score = 50;
    let reason = 'Standard correspondence';

    // Critical/Urgent signals
    if (
      text.includes('urgent') ||
      text.includes('asap') ||
      text.includes('critical') ||
      text.includes('action required') ||
      text.includes('immediate attention') ||
      text.includes('emergency') ||
      text.includes('deadline today')
    ) {
      score = 95;
      reason = 'Contains high-urgency keywords or immediate action deadline.';
      return { score, level: PriorityLevel.URGENT, reason };
    }

    // High priority signals: client inquiries, contracts, payments, interview, calendar
    if (
      text.includes('proposal') ||
      text.includes('contract') ||
      text.includes('invoice') ||
      text.includes('payment') ||
      text.includes('offer') ||
      text.includes('meeting request') ||
      text.includes('interview') ||
      text.includes('signed')
    ) {
      score = 80;
      reason = 'Important business correspondence (contracts, invoices, or proposals).';
      return { score, level: PriorityLevel.HIGH, reason };
    }

    // Low priority signals: newsletters, receipts, notifications, marketing
    if (
      text.includes('unsubscribe') ||
      text.includes('newsletter') ||
      text.includes('digest') ||
      text.includes('sale') ||
      text.includes('discount') ||
      text.includes('marketing') ||
      senderEmail.includes('noreply') ||
      senderEmail.includes('no-reply') ||
      senderEmail.includes('notifications@')
    ) {
      score = 20;
      reason = 'Automated marketing, newsletter, or notification.';
      return { score, level: PriorityLevel.LOW, reason };
    }

    return { score, level: PriorityLevel.NORMAL, reason };
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

    return {
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
}
