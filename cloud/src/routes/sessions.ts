import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateQuery, sessionQuerySchema } from '../utils/validation';

const router = Router();

/**
 * GET /api/sessions
 * Filterable, paginated session list.
 * Query params: location_id, plate, vehicle_type, payment_method, payment_status, date_from, date_to, page, limit
 */
router.get('/', authMiddleware, validateQuery(sessionQuerySchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const {
      location_id, plate, vehicle_type, payment_method,
      payment_status, date_from, date_to, page, limit,
    } = req.query as any;

    // Build where clause
    const where: Prisma.SessionWhereInput = {
      location: { tenant_id: tenantId },
    };

    if (location_id) where.location_id = location_id;
    if (plate) where.plate = { contains: plate, mode: 'insensitive' };
    if (vehicle_type) where.vehicle_type = vehicle_type;
    if (payment_method) where.payment_method = payment_method;
    if (payment_status) where.payment_status = payment_status;

    if (date_from || date_to) {
      where.entry_time = {};
      if (date_from) where.entry_time.gte = new Date(date_from);
      if (date_to) where.entry_time.lte = new Date(date_to);
    }

    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { entry_time: 'desc' },
        skip,
        take: limit,
        include: {
          location: { select: { name: true } },
          lane: { select: { lane_name: true } },
        },
      }),
      prisma.session.count({ where }),
    ]);

    res.json({
      sessions,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[Sessions] List error:', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

export default router;
