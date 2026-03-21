import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/locations
 * Get all locations for the authenticated tenant.
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;

    const locations = await prisma.location.findMany({
      where: { tenant_id: tenantId },
      include: {
        lanes: {
          select: {
            id: true,
            lane_name: true,
            lane_type: true,
            status: true,
            last_heartbeat: true,
          },
        },
        _count: {
          select: {
            sessions: { where: { exit_time: null } },
            members: { where: { active: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ locations });
  } catch (err) {
    console.error('[Locations] List error:', err);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

/**
 * GET /api/locations/:id
 * Get a single location with details.
 */
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const location = await prisma.location.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        lanes: true,
        _count: {
          select: {
            sessions: true,
            members: { where: { active: true } },
            alerts: { where: { resolved: false } },
          },
        },
      },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    res.json({ location });
  } catch (err) {
    console.error('[Locations] Get error:', err);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

export default router;
