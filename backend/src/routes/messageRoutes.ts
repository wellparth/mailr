import { Router, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { syncBroadcaster, SyncService } from '../services/syncService.js';
import { AIService } from '../services/aiService.js';
import { PriorityLevel } from '@prisma/client';

const router = Router();

// In-memory store for short-lived single-use SSE stream tickets (prevents passing primary JWTs in URLs)
interface StreamTicketData {
  userId: string;
  expiresAt: number;
}
const streamTickets = new Map<string, StreamTicketData>();

// Periodic cleanup of expired stream tickets
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of streamTickets.entries()) {
    if (data.expiresAt < now) {
      streamTickets.delete(ticket);
    }
  }
}, 60000);

// Request a short-lived single-use ticket for SSE streaming
router.post('/stream/ticket', authMiddleware, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const ticket = crypto.randomBytes(24).toString('hex');
  streamTickets.set(ticket, {
    userId: req.user.id,
    expiresAt: Date.now() + 60000, // 60 seconds validity
  });
  res.json({ success: true, ticket });
});

// 1. Real-Time SSE Stream for Mailbox Updates
router.get('/stream', async (req: AuthenticatedRequest, res: Response) => {
  let userId = '';

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const jwt = (await import('jsonwebtoken')).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mailr_secret_key_default') as { id: string };
      userId = decoded.id;
    } catch {
      res.status(401).json({ error: 'Invalid authorization token' });
      return;
    }
  } else if (req.query.ticket && typeof req.query.ticket === 'string') {
    const ticketData = streamTickets.get(req.query.ticket);
    if (!ticketData || ticketData.expiresAt < Date.now()) {
      streamTickets.delete(req.query.ticket);
      res.status(401).json({ error: 'Invalid or expired stream ticket' });
      return;
    }
    streamTickets.delete(req.query.ticket); // Enforce single-use
    userId = ticketData.userId;
  } else if (req.query.token && typeof req.query.token === 'string') {
    // Legacy fallback with validation
    try {
      const jwt = (await import('jsonwebtoken')).default;
      const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET || 'mailr_secret_key_default') as { id: string };
      userId = decoded.id;
    } catch {
      res.status(401).json({ error: 'Invalid stream token' });
      return;
    }
  } else {
    res.status(401).json({ error: 'Authentication ticket or bearer token required for live stream' });
    return;
  }

  // Setup SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  res.write(`data: ${JSON.stringify({ status: 'connected', timestamp: new Date() })}\n\n`);
  syncBroadcaster.addClient(userId, res);
});

// Require Auth for all remaining message endpoints
router.use(authMiddleware);

// 2. Unified Inbox Stream (Supports both /api/messages and /api/messages/unified)
router.get(['/', '/unified'], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      accountId,
      priorityOnly,
      folder = 'INBOX',
      isStarred,
      search,
      page = '1',
      limit = '100',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    let limitNum = Math.min(2000, Math.max(1, parseInt(limit as string, 10) || 100));
    if (limit === 'all') limitNum = 2000;
    const skip = (pageNum - 1) * limitNum;

    // Filter threads belonging to accounts owned by this user
    const whereCondition: Record<string, unknown> = {
      account: { userId: req.user!.id },
    };

    if (accountId && accountId !== 'all') {
      whereCondition.accountId = accountId as string;
    }

    if (priorityOnly === 'true') {
      whereCondition.priorityLevel = {
        in: [PriorityLevel.URGENT, PriorityLevel.HIGH],
      };
    }

    if (isStarred === 'true') {
      whereCondition.isStarred = true;
    }

    const now = new Date();
    if (folder === 'ARCHIVE') {
      whereCondition.isArchived = true;
    } else if (folder === 'SNOOZED') {
      whereCondition.isArchived = false;
      whereCondition.snoozedUntil = { gt: now };
    } else if (folder === 'SCHEDULED') {
      whereCondition.messages = { some: { status: 'SCHEDULED' } };
    } else if (folder === 'INBOX') {
      whereCondition.isArchived = false;
      whereCondition.AND = [
        {
          OR: [
            { snoozedUntil: null },
            { snoozedUntil: { lte: now } },
          ],
        },
      ];
    }

    if (search && typeof search === 'string' && search.trim().length > 0) {
      const searchTerm = search.trim();
      whereCondition.OR = [
        { subject: { contains: searchTerm } },
        { snippet: { contains: searchTerm } },
        { messages: { some: { senderEmail: { contains: searchTerm } } } },
        { messages: { some: { senderName: { contains: searchTerm } } } },
      ];
    }

    const [totalThreads, threads] = await Promise.all([
      prisma.thread.count({ where: whereCondition }),
      prisma.thread.findMany({
        where: whereCondition,
        include: {
          account: {
            select: {
              id: true,
              emailAddress: true,
              displayName: true,
              colorCode: true,
              provider: true,
            },
          },
          messages: {
            orderBy: { receivedAt: 'desc' },
            take: 1,
            select: {
              id: true,
              senderName: true,
              senderEmail: true,
              isRead: true,
              isFlagged: true,
              hasAttachments: true,
              receivedAt: true,
              calendarProposals: {
                select: {
                  id: true,
                  title: true,
                  startTime: true,
                  endTime: true,
                  status: true,
                },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    // Unread count aggregate
    const unreadCount = await prisma.message.count({
      where: {
        account: { userId: req.user!.id },
        isRead: false,
        isArchived: false,
      },
    });

    res.json({
      threads,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalThreads,
        totalPages: Math.ceil(totalThreads / limitNum),
        hasMore: skip + threads.length < totalThreads,
      },
      unreadCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 3. Get Full Conversation Thread (Supports both /threads/:id and /thread/:id)
router.get(['/threads/:id', '/thread/:id'], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const thread = await prisma.thread.findFirst({
      where: {
        id,
        account: { userId: req.user!.id },
      },
      include: {
        account: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            colorCode: true,
            provider: true,
          },
        },
        messages: {
          orderBy: { receivedAt: 'asc' },
          include: {
            attachments: true,
            calendarProposals: true,
          },
        },
      },
    });

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    // Auto mark all messages in thread as read
    await prisma.message.updateMany({
      where: { threadId: thread.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ thread });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 4. Send Email from any connected identity
router.post('/send', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fromAccountId = req.body.fromAccountId || req.body.accountId;
    const { to, cc, bcc, subject, bodyHtml, bodyText, attachments, scheduledAt } = req.body;
    const isScheduled = Boolean(scheduledAt && new Date(scheduledAt).getTime() > Date.now());

    if (!fromAccountId || !to || !subject || (!bodyHtml && !bodyText)) {
      res.status(400).json({ error: 'Missing required email fields (fromAccountId, to, subject, body)' });
      return;
    }

    const account = await prisma.emailAccount.findFirst({
      where: { id: fromAccountId, userId: req.user!.id },
    });

    if (!account) {
      res.status(404).json({ error: 'Sending account not found or unauthorized' });
      return;
    }

    // Recipients array
    const recipients = Array.isArray(to) ? to : [to];

    // Priority score
    const priority = AIService.calculatePriority(subject, bodyText || bodyHtml || '', account.emailAddress);
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    // Dispatch real email via mail adapter (Gmail, Outlook, or SMTP) unless scheduled for later
    let remoteMessageId = isScheduled ? `msg_sched_${Date.now()}` : `msg_sent_${Date.now()}`;
    if (!isScheduled) {
    try {
      const adapter = await SyncService.getAdapterForAccount(account);
      const sendResult = await adapter.sendMail({
        from: account.displayName ? `"${account.displayName}" <${account.emailAddress}>` : account.emailAddress,
        to: recipients,
        cc: Array.isArray(cc) ? cc : cc ? [cc] : undefined,
        bcc: Array.isArray(bcc) ? bcc : bcc ? [bcc] : undefined,
        subject,
        bodyHtml: bodyHtml || `<p>${bodyText}</p>`,
        bodyText: bodyText || bodyHtml,
        attachments: hasAttachments
          ? attachments
              .filter((att: any) => att.base64)
              .map((att: any) => ({
                filename: att.filename || 'attachment',
                content: Buffer.from(att.base64, 'base64'),
                contentType: att.contentType || 'application/octet-stream',
              }))
          : undefined,
      });

      if (sendResult?.messageId) {
        remoteMessageId = sendResult.messageId;
      }
    } catch (dispatchErr: unknown) {
      console.error(`[SendMail Error] Account ${account.emailAddress}:`, dispatchErr);
      const dispatchMsg = dispatchErr instanceof Error ? dispatchErr.message : 'Unknown mail dispatch error';
      if (process.env.NODE_ENV === 'production') {
        res.status(502).json({ error: `Mail delivery failed: ${dispatchMsg}` });
        return;
      }
      console.warn(`[SendMail Dev Notice] Outgoing mail simulated due to: ${dispatchMsg}`);
    }
    }

    // Create thread & message in database
    const thread = await prisma.thread.create({
      data: {
        accountId: account.id,
        remoteThreadId: `sent_${Date.now()}`,
        subject,
        snippet: (bodyText || bodyHtml || '').substring(0, 150),
        priorityScore: priority.score,
        priorityLevel: priority.level,
        priorityReason: priority.reason,
        lastMessageAt: new Date(),
      },
    });

    const message = await prisma.message.create({
      data: {
        threadId: thread.id,
        accountId: account.id,
        remoteMessageId,
        senderName: account.displayName,
        senderEmail: account.emailAddress,
        recipientList: recipients,
        ccList: cc || [],
        bccList: bcc || [],
        subject,
        snippet: (bodyText || bodyHtml || '').substring(0, 150),
        bodyHtml: bodyHtml || `<p>${bodyText}</p>`,
        bodyText: bodyText || bodyHtml,
        isRead: true,
        hasAttachments,
        status: isScheduled ? 'SCHEDULED' : 'SENT',
        scheduledAt: isScheduled ? new Date(scheduledAt) : null,
        receivedAt: new Date(),
        attachments: hasAttachments
          ? {
              create: attachments.map((att: any) => ({
                filename: att.filename || 'attachment',
                contentType: att.contentType || 'application/octet-stream',
                sizeBytes: Number(att.sizeBytes) || 0,
                filePath: att.base64
                  ? `data:${att.contentType || 'application/octet-stream'};base64,${att.base64}`
                  : att.filePath || '',
              })),
            }
          : undefined,
      },
    });

    // Notify client via SSE
    syncBroadcaster.notifyUser(req.user!.id, 'message_sent', {
      threadId: thread.id,
      messageId: message.id,
      subject,
    });

    res.status(201).json({
      success: true,
      message: 'Email dispatched successfully.',
      threadId: thread.id,
      messageId: message.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Send email error';
    res.status(500).json({ error: msg });
  }
});

// 5. Toggle Read / Unread
router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body;

    const message = await prisma.message.findFirst({
      where: { id, account: { userId: req.user!.id } },
    });

    if (!message) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { isRead: Boolean(isRead) },
    });

    res.json({ success: true, message: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 6. Toggle Star / Flag
router.patch('/:id/star', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const thread = await prisma.thread.findFirst({
      where: { id, account: { userId: req.user!.id } },
    });

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const updated = await prisma.thread.update({
      where: { id },
      data: { isStarred: !thread.isStarred },
    });

    res.json({ success: true, thread: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 7. Archive / Unarchive Thread
router.post('/threads/:id/archive', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isArchived = true } = req.body;

    const thread = await prisma.thread.findFirst({
      where: { id, account: { userId: req.user!.id } },
    });

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    await prisma.thread.update({
      where: { id },
      data: { isArchived: Boolean(isArchived) },
    });

    await prisma.message.updateMany({
      where: { threadId: id },
      data: { isArchived: Boolean(isArchived) },
    });

    res.json({ success: true, message: `Thread ${isArchived ? 'archived' : 'unarchived'}` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});


// 8. Snooze / Unsnooze Thread
router.post(['/threads/:id/snooze', '/thread/:id/snooze'], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { snoozedUntil } = req.body;

    const thread = await prisma.thread.findFirst({
      where: { id, account: { userId: req.user!.id } },
    });

    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const updated = await prisma.thread.update({
      where: { id },
      data: {
        snoozedUntil: snoozedUntil ? new Date(snoozedUntil) : null,
      },
    });

    syncBroadcaster.notifyUser(req.user!.id, 'thread_snoozed', {
      threadId: id,
      snoozedUntil: updated.snoozedUntil?.toISOString() || null,
    });

    res.json({
      success: true,
      message: snoozedUntil
        ? `Thread snoozed until ${new Date(snoozedUntil).toLocaleString()}`
        : 'Thread unsnoozed',
      thread: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Snooze error';
    res.status(500).json({ error: msg });
  }
});

// 9. 1-Click Newsletter Unsubscribe & Auto-Archive
router.post(['/threads/:id/unsubscribe', '/thread/:id/unsubscribe'], async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const thread = await prisma.thread.findFirst({
      where: { id, account: { userId: req.user!.id } },
      include: {
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }

    const latestMessage = thread.messages[0];
    let unsubscribeUrl: string | null = latestMessage.unsubscribeUrl || null;

    // Detect unsubscribe link from HTML body if not already stored
    if (!unsubscribeUrl && latestMessage.bodyHtml) {
      const match = latestMessage.bodyHtml.match(/href=["'](https?:\/\/[^"']*(?:unsubscribe|optout|opt-out|preferences)[^"']*)["']/i);
      if (match) {
        unsubscribeUrl = match[1];
      }
    }

    // Auto-archive thread & tag as newsletter
    await prisma.thread.update({
      where: { id },
      data: { isArchived: true },
    });

    await prisma.message.updateMany({
      where: { threadId: id },
      data: { isArchived: true, isNewsletter: true },
    });

    syncBroadcaster.notifyUser(req.user!.id, 'thread_unsubscribed', {
      threadId: id,
      senderEmail: latestMessage.senderEmail,
      unsubscribeUrl,
    });

    res.json({
      success: true,
      unsubscribeUrl,
      message: unsubscribeUrl
        ? 'Unsubscribe link detected and thread auto-archived.'
        : 'Thread auto-archived and sender marked as newsletter.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unsubscribe error';
    res.status(500).json({ error: msg });
  }
});

export default router;
