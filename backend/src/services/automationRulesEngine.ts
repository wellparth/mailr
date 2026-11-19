import prisma from '../db.js';
import { redis } from './redisClient.js';

export interface RuleEvaluationContext {
  threadId: string;
  subject: string;
  snippet?: string | null;
  priorityLevel: string;
  priorityScore: number;
  priorityReason?: string | null;
  accountId: string;
  senderName?: string | null;
  senderEmail: string;
  bodyText?: string | null;
  receivedAt: Date | string;
}

export const DEFAULT_AUTOMATION_PRESETS = [
  {
    name: 'Receipt & Invoice Vault',
    description: 'Auto-detect billing statements, invoices, and purchase receipts, star the thread, and archive it from Inbox.',
    triggerType: 'RECEIPT_VAULT',
    conditions: {
      keywords: ['invoice', 'receipt', 'order confirmation', 'payment received', 'billing statement', 'subscription renewed', 'stripe', 'paypal'],
    },
    actions: {
      autoArchive: true,
      star: true,
      tag: 'Receipt',
    },
    isEnabled: true,
  },
  {
    name: 'Smart Availability Draft Preparer',
    description: 'When an incoming email requests meeting availability or scheduling, auto-generate a polite reply embedding your booking link in Drafts for 1-click review.',
    triggerType: 'DRAFT_PREPARER',
    conditions: {
      keywords: ['schedule', 'meet', 'sync', 'catch up', 'hop on a call', 'availability', 'time to chat', 'calendar link', 'booking link'],
    },
    actions: {
      createDraft: true,
      embedBookingLink: true,
    },
    isEnabled: true,
  },
  {
    name: 'VIP Sender Priority Elevation',
    description: 'Automatically star and elevate priority to HIGH for important clients, executives, and partners.',
    triggerType: 'VIP_TAGGING',
    conditions: {
      vipDomains: ['google.com', 'apple.com', 'microsoft.com', 'ycombinator.com'],
      vipEmails: [],
    },
    actions: {
      elevatePriority: 'HIGH',
      star: true,
    },
    isEnabled: true,
  },
  {
    name: 'Stale Newsletter Purger',
    description: 'Automatically clean up promotional emails and newsletter digests that have sat unread for more than 7 days.',
    triggerType: 'STALE_PURGE',
    conditions: {
      minAgeDays: 7,
      unreadOnly: true,
    },
    actions: {
      autoArchive: true,
    },
    isEnabled: true,
  },
];

export class AutomationRulesEngine {
  /**
   * Initializes default automation rules for a user if none exist.
   */
  static async ensureDefaultRules(userId: string) {
    const existingCount = await prisma.automationRule.count({
      where: { userId },
    });

    if (existingCount === 0) {
      for (const preset of DEFAULT_AUTOMATION_PRESETS) {
        await prisma.automationRule.create({
          data: {
            userId,
            name: preset.name,
            description: preset.description,
            triggerType: preset.triggerType,
            conditions: preset.conditions,
            actions: preset.actions,
            isEnabled: preset.isEnabled,
          },
        });
      }
    }
  }

  /**
   * Evaluates all enabled automation rules against a newly ingested email message.
   */
  static async evaluateInboundMessage(userId: string, ctx: RuleEvaluationContext): Promise<void> {
    try {
      const activeRules = await prisma.automationRule.findMany({
        where: { userId, isEnabled: true },
      });

      if (activeRules.length === 0) return;

      const combinedText = `${ctx.subject} ${ctx.snippet || ''} ${ctx.bodyText || ''}`.toLowerCase();
      const senderEmailLower = ctx.senderEmail.toLowerCase();
      const senderDomain = senderEmailLower.split('@')[1] || '';

      for (const rule of activeRules) {
        try {
          let matched = false;
          let actionSummary = '';

          // 1. RECEIPT & INVOICE VAULT
          if (rule.triggerType === 'RECEIPT_VAULT') {
            const receiptRegex = /\b(invoice|receipt|order\s*(?:confirmation|#)|payment\s*(?:received|confirmation)|billing\s*statement|subscription\s*renewed|stripe|paypal)\b/i;
            if (receiptRegex.test(combinedText)) {
              matched = true;
              actionSummary = 'Auto-archived financial receipt / invoice & starred';

              await prisma.thread.update({
                where: { id: ctx.threadId },
                data: {
                  isArchived: true,
                  isStarred: true,
                },
              });
            }
          }

          // 2. SMART DRAFT PREPARER
          else if (rule.triggerType === 'DRAFT_PREPARER') {
            const meetingRegex = /(?:can we|let's|could we|would love to)\s+(?:schedule|meet|sync|catch up|hop on a call)|what(?:'s| is) your availability|time to chat|send (?:over )?your (?:calendar|link)|booking link/i;
            if (meetingRegex.test(combinedText)) {
              // Deduplicate draft creation
              const draftKey = `mailr:auto_draft:${ctx.threadId}`;
              const alreadyDrafted = await redis.get(draftKey);

              if (!alreadyDrafted) {
                // Fetch user booking link
                const bookingIntegration = await prisma.calendarIntegration.findFirst({
                  where: { userId, bookingUrl: { not: null } },
                  select: { bookingUrl: true, provider: true },
                });

                const bookingLink = bookingIntegration?.bookingUrl || 'https://cal.com/your-username/30min';
                const recipientEmail = ctx.senderEmail;
                const cleanSubject = ctx.subject.replace(/^(re:\s*|fwd:\s*)/i, '').trim();

                const draftHtml = [
                  `<p>Hi ${ctx.senderName || 'there'},</p>`,
                  `<p>Thanks for reaching out! I'd be glad to sync. Please feel free to select any time that fits your schedule best via my booking link:</p>`,
                  `<p>👉 <a href="${bookingLink}" style="color: #3b82f6; font-weight: bold;">${bookingLink}</a></p>`,
                  `<p>Looking forward to speaking.</p>`,
                ].join('\n');

                const draftText = `Hi ${ctx.senderName || 'there'},\n\nThanks for reaching out! I'd be glad to sync. Please feel free to pick any time that fits your schedule best via my booking link:\n${bookingLink}\n\nLooking forward to speaking.`;

                await prisma.message.create({
                  data: {
                    threadId: ctx.threadId,
                    accountId: ctx.accountId,
                    remoteMessageId: `autodraft_${Date.now()}`,
                    senderName: 'You (AI Draft)',
                    senderEmail: recipientEmail,
                    recipientList: [recipientEmail],
                    subject: `Re: ${cleanSubject}`,
                    snippet: `Hi, thanks for reaching out! Please feel free to select a time that fits your schedule via my booking link: ${bookingLink}`,
                    bodyHtml: draftHtml,
                    bodyText: draftText,
                    status: 'DRAFT',
                    isRead: true,
                    receivedAt: new Date(),
                  },
                });

                await redis.set(draftKey, '1', 3600); // 1 hour dedup
                matched = true;
                actionSummary = `Auto-prepared scheduling reply draft with booking link (${bookingIntegration?.provider || 'Booking Link'})`;
              }
            }
          }

          // 3. VIP SENDER PRIORITY ELEVATION
          else if (rule.triggerType === 'VIP_TAGGING') {
            const conditions = rule.conditions as any;
            const vipEmails: string[] = conditions?.vipEmails || [];
            const vipDomains: string[] = conditions?.vipDomains || [];

            const isVipEmail = vipEmails.some((e) => e.toLowerCase() === senderEmailLower);
            const isVipDomain = vipDomains.some((d) => d.toLowerCase() === senderDomain.toLowerCase());

            if (isVipEmail || isVipDomain) {
              matched = true;
              actionSummary = `Elevated priority to HIGH & starred for VIP contact (${ctx.senderEmail})`;

              await prisma.thread.update({
                where: { id: ctx.threadId },
                data: {
                  priorityLevel: 'HIGH',
                  priorityScore: Math.max(ctx.priorityScore, 90),
                  priorityReason: `VIP Contact Rule: ${ctx.senderEmail}`,
                  isStarred: true,
                },
              });
            }
          }

          // Log and update rule stats if matched
          if (matched && actionSummary) {
            await prisma.automationRule.update({
              where: { id: rule.id },
              data: {
                runsCount: { increment: 1 },
                lastRunAt: new Date(),
              },
            });

            await prisma.automationLog.create({
              data: {
                ruleId: rule.id,
                userId,
                threadId: ctx.threadId,
                actionTaken: actionSummary,
                details: {
                  threadSubject: ctx.subject,
                  sender: ctx.senderEmail,
                  timestamp: new Date(),
                },
              },
            });
          }
        } catch (ruleErr) {
          console.warn(`[AutomationRulesEngine] Error evaluating rule ${rule.name}:`, ruleErr);
        }
      }
    } catch (err) {
      console.error('[AutomationRulesEngine] Inbound evaluation error:', err);
    }
  }

  /**
   * Sweeps and archives unread newsletter & digest emails older than 7 days.
   */
  static async purgeStaleNewsletters(userId: string): Promise<number> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Find stale threads
      const staleThreads = await prisma.thread.findMany({
        where: {
          account: { userId },
          isArchived: false,
          lastMessageAt: { lt: sevenDaysAgo },
          messages: {
            some: {
              OR: [
                { isNewsletter: true },
                { unsubscribeUrl: { not: null } },
                { subject: { contains: 'digest' } },
                { subject: { contains: 'newsletter' } },
                { subject: { contains: 'weekly' } },
              ],
              isRead: false,
            },
          },
        },
        select: { id: true, subject: true },
        take: 100,
      });

      if (staleThreads.length === 0) return 0;

      const threadIds = staleThreads.map((t) => t.id);

      await prisma.thread.updateMany({
        where: { id: { in: threadIds } },
        data: { isArchived: true },
      });

      // Find or create rule log for stale purge
      const staleRule = await prisma.automationRule.findFirst({
        where: { userId, triggerType: 'STALE_PURGE' },
      });

      if (staleRule) {
        await prisma.automationRule.update({
          where: { id: staleRule.id },
          data: {
            runsCount: { increment: staleThreads.length },
            lastRunAt: new Date(),
          },
        });

        await prisma.automationLog.create({
          data: {
            ruleId: staleRule.id,
            userId,
            actionTaken: `Auto-archived ${staleThreads.length} unread newsletters older than 7 days`,
            details: {
              purgedCount: staleThreads.length,
              threadTitles: staleThreads.slice(0, 5).map((t) => t.subject),
            },
          },
        });
      }

      return staleThreads.length;
    } catch (err) {
      console.error('[AutomationRulesEngine] Stale purge error:', err);
      return 0;
    }
  }
}
