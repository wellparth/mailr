import { Router, Response } from 'express';
import prisma from '../db.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { AutomationRulesEngine } from '../services/automationRulesEngine.js';

const router = Router();
router.use(authMiddleware);

// 1. Get all automation rules (auto-seeds defaults if 0 exist)
router.get('/rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await AutomationRulesEngine.ensureDefaultRules(userId);

    const rules = await prisma.automationRule.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      rules,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error fetching automation rules';
    res.status(500).json({ error: msg });
  }
});

// 2. Toggle rule active state
router.patch('/rules/:id/toggle', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const rule = await prisma.automationRule.findFirst({
      where: { id, userId },
    });

    if (!rule) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    const updated = await prisma.automationRule.update({
      where: { id },
      data: { isEnabled: !rule.isEnabled },
    });

    res.json({
      success: true,
      rule: updated,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error toggling rule';
    res.status(500).json({ error: msg });
  }
});

// 3. Update rule configuration (conditions, actions, or name)
router.patch('/rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { name, conditions, actions, isEnabled } = req.body;

    const updated = await prisma.automationRule.updateMany({
      where: { id, userId },
      data: {
        ...(name ? { name } : {}),
        ...(conditions ? { conditions } : {}),
        ...(actions ? { actions } : {}),
        ...(typeof isEnabled === 'boolean' ? { isEnabled } : {}),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: 'Rule not found' });
      return;
    }

    const rule = await prisma.automationRule.findUnique({ where: { id } });
    res.json({ success: true, rule });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error updating rule';
    res.status(500).json({ error: msg });
  }
});

// 4. Create custom rule
router.post('/rules', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, description, triggerType, conditions, actions } = req.body;

    if (!name || !triggerType) {
      res.status(400).json({ error: 'Name and triggerType are required.' });
      return;
    }

    const created = await prisma.automationRule.create({
      data: {
        userId,
        name,
        description,
        triggerType,
        conditions: conditions || {},
        actions: actions || {},
        isEnabled: true,
      },
    });

    res.json({ success: true, rule: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error creating rule';
    res.status(500).json({ error: msg });
  }
});

// 5. Delete rule
router.delete('/rules/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.automationRule.deleteMany({
      where: { id, userId },
    });

    res.json({ success: true, message: 'Rule deleted successfully' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error deleting rule';
    res.status(500).json({ error: msg });
  }
});

// 6. Get execution audit trail / logs
router.get('/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const logs = await prisma.automationLog.findMany({
      where: { userId },
      include: {
        rule: { select: { name: true, triggerType: true } },
        thread: { select: { subject: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, logs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error fetching automation logs';
    res.status(500).json({ error: msg });
  }
});

// 7. Manually trigger 7-day stale newsletter purge
router.post('/run-stale-purge', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const purgedCount = await AutomationRulesEngine.purgeStaleNewsletters(userId);

    res.json({
      success: true,
      purgedCount,
      message: purgedCount > 0
        ? `Successfully auto-archived ${purgedCount} stale unread newsletters.`
        : 'Zero stale newsletters found (inbox clean).',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error running stale purge';
    res.status(500).json({ error: msg });
  }
});

export default router;
