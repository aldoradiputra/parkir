import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/alerts/:locationId
 * Get alerts for a location.
 * Query params: resolved (boolean), alert_type, limit
 */
router.get('/:locationId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const locationId = req.params.locationId as string;
    const resolved = req.query.resolved as string | undefined;
    const alert_type = req.query.alert_type as string | undefined;
    const limitStr = req.query.limit as string | undefined;

    const location = await prisma.location.findFirst({
      where: { id: locationId, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const where: any = { location_id: locationId };
    if (resolved !== undefined) where.resolved = resolved === 'true';
    if (alert_type) where.alert_type = alert_type;

    const limit = Math.min(parseInt(limitStr ?? '50', 10), 200);

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      include: {
        lane: { select: { lane_name: true } },
      },
    });

    res.json({ alerts });
  } catch (err) {
    console.error('[Alerts] List error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * PUT /api/alerts/:id/resolve
 * Resolve an alert.
 */
router.put('/:id/resolve', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!alert || alert.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    if (alert.resolved) {
      res.status(400).json({ error: 'Alert is already resolved' });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        resolved: true,
        resolved_by: req.tenant!.email,
        resolved_at: new Date(),
      },
    });

    res.json({ alert: updated });
  } catch (err) {
    console.error('[Alerts] Resolve error:', err);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

export default router;
