import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { AgentService } from '../services/agentService.js';
import { LLMClient, AIProvider } from '../services/llmClient.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';

const router = Router();

router.use(authMiddleware);

// 1. Send natural language prompt to AI Copilot
router.post('/chat', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { prompt, threadId } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt is required.' });
      return;
    }

    const response = await AgentService.chatWithAgent(req.user!.id, prompt, threadId);
    res.json(response);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Chat error';
    res.status(500).json({ error: msg });
  }
});

// 2. Get Copilot chat message history
router.get('/history/:threadId?', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const messages = await prisma.agentChatMessage.findMany({
      where: {
        userId: req.user!.id,
        threadId: threadId ? threadId : undefined,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    res.json({ messages });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'History error';
    res.status(500).json({ error: msg });
  }
});

// 3. Generate structured notes for a thread
router.post('/notes/generate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.body;
    if (!threadId) {
      res.status(400).json({ error: 'Thread ID is required.' });
      return;
    }

    const notes = await AgentService.generateThreadNotes(req.user!.id, threadId);
    res.json({ success: true, notes });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Notes generation error';
    res.status(500).json({ error: msg });
  }
});

// 4. Get saved notes for a thread
router.get('/notes/:threadId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId } = req.params;
    const note = await prisma.threadNote.findUnique({
      where: {
        userId_threadId: {
          userId: req.user!.id,
          threadId,
        },
      },
    });

    res.json({ note });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Notes fetch error';
    res.status(500).json({ error: msg });
  }
});

// 5. Toggle action item completion status in note
router.patch('/notes/:noteId/toggle-item', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { noteId } = req.params;
    const { taskIndex, completed } = req.body;

    const note = await prisma.threadNote.findFirst({
      where: { id: noteId, userId: req.user!.id },
    });

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    const items = Array.isArray(note.actionItems) ? [...(note.actionItems as any[])] : [];
    if (items[taskIndex]) {
      items[taskIndex].completed = Boolean(completed);
    }

    const updated = await prisma.threadNote.update({
      where: { id: noteId },
      data: { actionItems: items },
    });

    res.json({ success: true, note: updated });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action item toggle error';
    res.status(500).json({ error: msg });
  }
});

// 6. Schedule meeting from thread
router.post('/calendar/schedule', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { threadId, customOptions } = req.body;
    if (!threadId) {
      res.status(400).json({ error: 'Thread ID is required.' });
      return;
    }

    const meeting = await AgentService.scheduleMeetingFromThread(req.user!.id, threadId, customOptions);
    res.json({ success: true, meeting });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Meeting schedule error';
    res.status(500).json({ error: msg });
  }
});

// 7. Get user's calendar integrations (Cal.com / Calendly)
router.get('/calendar/integrations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const integrations = await prisma.calendarIntegration.findMany({
      where: { userId: req.user!.id },
    });

    res.json({ integrations });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Integrations error';
    res.status(500).json({ error: msg });
  }
});

// 8. Save or update Cal.com / Calendly integration
router.post('/calendar/integrations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, bookingUrl, isDefault = true } = req.body;
    if (!provider || !['CAL_COM', 'CALENDLY', 'GOOGLE', 'OUTLOOK'].includes(provider)) {
      res.status(400).json({ error: 'Valid provider is required (CAL_COM, CALENDLY, GOOGLE, OUTLOOK).' });
      return;
    }

    let sanitizedBookingUrl: string | null = null;
    if (bookingUrl && typeof bookingUrl === 'string' && bookingUrl.trim().length > 0) {
      try {
        const parsed = new URL(bookingUrl.trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          res.status(400).json({ error: 'bookingUrl must use http or https protocol' });
          return;
        }
        sanitizedBookingUrl = parsed.toString();
      } catch {
        res.status(400).json({ error: 'Invalid bookingUrl format' });
        return;
      }
    }

    const integration = await prisma.calendarIntegration.upsert({
      where: {
        userId_provider: {
          userId: req.user!.id,
          provider,
        },
      },
      create: {
        userId: req.user!.id,
        provider,
        bookingUrl: sanitizedBookingUrl,
        isDefault,
      },
      update: {
        bookingUrl: sanitizedBookingUrl,
        isDefault,
      },
    });

    res.json({ success: true, integration });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Save integration error';
    res.status(500).json({ error: msg });
  }
});

// 9. BYOK: Get user AI provider & whether key is configured
router.get('/byok', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { aiProvider: true, encryptedAiKey: true },
    });

    res.json({
      provider: user?.aiProvider || (process.env.NVIDIA_API_KEY ? 'nvidia' : 'openai'),
      hasCustomKey: Boolean(user?.encryptedAiKey && user.encryptedAiKey.length > 0),
      serverHasKey: Boolean(process.env.NVIDIA_API_KEY),
      supportedProviders: [
        { id: 'nvidia', name: 'NVIDIA NIM (Nemotron 3.5 Bolt - Free)', placeholder: 'nvapi-...' },
        { id: 'openai', name: 'OpenAI (GPT-4o, GPT-4o-mini)', placeholder: 'sk-proj-...' },
        { id: 'claude', name: 'Anthropic Claude (3.5 Sonnet, 3.5 Haiku)', placeholder: 'sk-ant-api03-...' },
        { id: 'google', name: 'Google Gemini (1.5 Flash, 1.5 Pro)', placeholder: 'AIzaSy...' },
      ],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'BYOK status error';
    res.status(500).json({ error: msg });
  }
});

// 10. BYOK: Save user's custom API key (AES-256-GCM encrypted)
router.post('/byok', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !['openai', 'claude', 'google', 'nvidia'].includes(provider.toLowerCase())) {
      res.status(400).json({ error: 'Valid provider is required (openai, claude, google, nvidia).' });
      return;
    }

    const encryptedAiKey = apiKey && apiKey.trim().length > 0 ? encryptSecret(apiKey.trim()) : null;

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        aiProvider: provider.toLowerCase(),
        encryptedAiKey,
      },
    });

    res.json({
      success: true,
      message: `AI credentials updated for ${provider.toUpperCase()}.`,
      provider: provider.toLowerCase(),
      hasCustomKey: Boolean(encryptedAiKey),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'BYOK save error';
    res.status(500).json({ error: msg });
  }
});

// 11. BYOK: Test API key before saving
router.post('/byok/test', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { provider, apiKey, model } = req.body;
    if (!provider || !apiKey) {
      res.status(400).json({ error: 'Provider and API key are required for testing.' });
      return;
    }

    const testRes = await LLMClient.testApiKey(provider as AIProvider, apiKey, model);
    res.json(testRes);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Test failed';
    res.status(500).json({ success: false, message: msg });
  }
});


// 12. Daily Executive Morning Briefing
router.get('/briefing', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const briefing = await AgentService.getMorningBriefing(req.user!.id);
    res.json(briefing);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Briefing error';
    res.status(500).json({ error: msg });
  }
});

// 13. Smart Follow-Up Suggestions
router.get('/follow-ups', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const suggestions = await AgentService.getFollowUpSuggestions(req.user!.id);
    res.json(suggestions);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Follow-up suggestions error';
    res.status(500).json({ error: msg });
  }
});

export default router;
