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
      filters.olderThanDays = parseInt(daysMatch[1], 10);
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
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`,
      `STATUS:CONFIRMED`,
      ...event.attendees.map(
        (a) => `ATTENDEE;CN=${a.name || a.email};ROLE=REQ-PARTICIPANT:mailto:${a.email}`
      ),
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
