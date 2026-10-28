import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { syncBroadcaster } from '../services/syncService.js';
import { AIService } from '../services/aiService.js';
import { PriorityLevel } from '@prisma/client';

const router = Router();

// 1. Real-Time SSE Stream for Mailbox Updates (Must be authenticated or accept query token)
router.get('/stream', async (req: AuthenticatedRequest, res: Response) => {
  const token = req.query.token as string;
  let userId = '';

  if (req.user?.id) {
    userId = req.user.id;
  } else if (token) {
    try {
      const jwt = (await import('jsonwebtoken')).default;
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mailr_secret_key_default') as { id: string };
      userId = decoded.id;
    } catch {
      res.status(401).json({ error: 'Invalid stream token' });
      return;
    }
  } else {
    res.status(401).json({ error: 'Auth required for live stream' });
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

// 2. Unified Inbox Stream
router.get('/unified', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      accountId,
      priorityOnly,
      folder = 'INBOX',
      isStarred,
      search,
      page = '1',
      limit = '30',
    } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 30;
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

    if (folder === 'ARCHIVE') {
      whereCondition.isArchived = true;
    } else if (folder === 'INBOX') {
      whereCondition.isArchived = false;
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
      },
      unreadCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    res.status(500).json({ error: msg });
  }
});

// 3. Get Full Conversation Thread
router.get('/threads/:id', async (req: AuthenticatedRequest, res: Response) => {
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
    const { to, cc, bcc, subject, bodyHtml, bodyText, attachments } = req.body;

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
        remoteMessageId: `msg_sent_${Date.now()}`,
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

export default router;
