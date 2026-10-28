import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { AIService } from '../services/aiService.js';
import { syncBroadcaster } from '../services/syncService.js';
import { ProposalStatus } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

// 1. Natural Language Triage Command
router.post('/triage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, accountId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'A natural language prompt is required.' });
      return;
    }

    const result = await AIService.executeTriage(req.user!.id, prompt, accountId);

    // Broadcast update to client
    syncBroadcaster.notifyUser(req.user!.id, 'triage_executed', {
      prompt,
      affectedCount: result.affectedCount,
    });

    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Triage error';
    res.status(500).json({ error: msg });
  }
});

// 2. Rescore Priority for Inbox
router.post('/priority/rescore', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const threads = await prisma.thread.findMany({
      where: {
        account: { userId: req.user!.id },
        isArchived: false,
      },
      include: {
        messages: {
          take: 1,
          orderBy: { receivedAt: 'desc' },
          select: { senderEmail: true },
        },
      },
    });

    let updatedCount = 0;
    for (const thread of threads) {
      const sender = thread.messages[0]?.senderEmail || '';
      const priority = AIService.calculatePriority(thread.subject, thread.snippet || '', sender);

      await prisma.thread.update({
        where: { id: thread.id },
        data: {
          priorityScore: priority.score,
          priorityLevel: priority.level,
          priorityReason: priority.reason,
        },
      });
      updatedCount++;
    }

    syncBroadcaster.notifyUser(req.user!.id, 'priority_rescored', { updatedCount });

    res.json({ success: true, updatedCount, message: `Rescored ${updatedCount} threads successfully.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Rescore failed';
    res.status(500).json({ error: msg });
  }
});

// 3. Get Calendar Proposals
router.get('/calendar/proposals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const proposals = await prisma.calendarProposal.findMany({
      where: { userId: req.user!.id },
      include: {
        message: {
          select: {
            id: true,
            subject: true,
            senderEmail: true,
            senderName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ proposals });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Calendar proposals error';
    res.status(500).json({ error: msg });
  }
});

// 4. Accept / Confirm Calendar Proposal
router.post('/calendar/proposals/:id/accept', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const proposal = await prisma.calendarProposal.findFirst({
      where: { id, userId: req.user!.id },
      include: { message: true },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const updated = await prisma.calendarProposal.update({
      where: { id },
      data: { status: ProposalStatus.ACCEPTED },
    });

    // Generate Google Calendar Link
    const startIso = proposal.startTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const endIso = proposal.endTime.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const gCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
      proposal.title
    )}&details=${encodeURIComponent(proposal.description || '')}&dates=${startIso}/${endIso}`;

    res.json({
      success: true,
      proposal: updated,
      googleCalendarUrl: gCalUrl,
      message: 'Booking proposal accepted.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Accept proposal error';
    res.status(500).json({ error: msg });
  }
});

// 5. Download .ics iCalendar file
router.get('/calendar/proposals/:id/ics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const proposal = await prisma.calendarProposal.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!proposal) {
      res.status(404).json({ error: 'Proposal not found' });
      return;
    }

    const attendees = Array.isArray(proposal.attendees)
      ? (proposal.attendees as { email: string; name?: string }[])
      : [];

    const icsContent = AIService.generateICS({
      title: proposal.title,
      description: proposal.description || '',
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      attendees,
    });

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="meeting_${proposal.id}.ics"`);
    res.send(icsContent);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'ICS export error';
    res.status(500).json({ error: msg });
  }
});

// 6. Generate Context-Aware AI Draft Reply
router.post('/draft', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId, tone = 'professional' } = req.body;

    if (!threadId) {
      res.status(400).json({ error: 'Thread ID is required' });
      return;
    }

    const thread = await prisma.thread.findFirst({
      where: { id: threadId, account: { userId: req.user!.id } },
      include: {
        messages: {
          orderBy: { receivedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!thread || thread.messages.length === 0) {
      res.status(404).json({ error: 'Thread or messages not found' });
      return;
    }

    const latestMessage = thread.messages[0];
    const draftText = AIService.generateDraftReply(
      thread.subject,
      latestMessage.bodyText || latestMessage.snippet || '',
      tone
    );

    res.json({
      success: true,
      draft: draftText,
      tone,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Draft error';
    res.status(500).json({ error: msg });
  }
});

export default router;
