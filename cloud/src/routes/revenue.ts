import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/revenue/daily
 * Get daily revenue records.
 * Query params: location_id (required), date_from, date_to, limit
 */
router.get('/daily', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const { location_id, date_from, date_to, limit: limitStr } = req.query as Record<string, string>;

    if (!location_id) {
      res.status(400).json({ error: 'location_id is required' });
      return;
    }

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: { id: location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const where: any = { location_id };

    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    const limit = parseInt(limitStr ?? '30', 10);

    const revenues = await prisma.dailyRevenue.findMany({
      where,
      orderBy: { date: 'desc' },
      take: Math.min(limit, 365),
    });

    res.json({ revenues });
  } catch (err) {
    console.error('[Revenue] Daily error:', err);
    res.status(500).json({ error: 'Failed to fetch daily revenue' });
  }
});

/**
 * GET /api/revenue/summary
 * Get revenue summary for a location over a date range.
 * Query params: location_id (required), date_from, date_to
 */
router.get('/summary', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const { location_id, date_from, date_to } = req.query as Record<string, string>;

    if (!location_id) {
      res.status(400).json({ error: 'location_id is required' });
      return;
    }

    const location = await prisma.location.findFirst({
      where: { id: location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const where: any = { location_id };
    if (date_from || date_to) {
      where.date = {};
      if (date_from) where.date.gte = new Date(date_from);
      if (date_to) where.date.lte = new Date(date_to);
    }

    const aggregation = await prisma.dailyRevenue.aggregate({
      where,
      _sum: {
        total_sessions: true,
        total_revenue: true,
        qris_revenue: true,
        nfc_revenue: true,
        monthly_revenue: true,
        cash_revenue: true,
        waived_amount: true,
        car_sessions: true,
        motorcycle_sessions: true,
      },
      _avg: {
        total_revenue: true,
        total_sessions: true,
        avg_duration_min: true,
      },
      _count: true,
    });

    res.json({
      summary: {
        days_count: aggregation._count,
        total_sessions: aggregation._sum.total_sessions ?? 0,
        total_revenue: aggregation._sum.total_revenue ?? 0,
        qris_revenue: aggregation._sum.qris_revenue ?? 0,
        nfc_revenue: aggregation._sum.nfc_revenue ?? 0,
        monthly_revenue: aggregation._sum.monthly_revenue ?? 0,
        cash_revenue: aggregation._sum.cash_revenue ?? 0,
        waived_amount: aggregation._sum.waived_amount ?? 0,
        car_sessions: aggregation._sum.car_sessions ?? 0,
        motorcycle_sessions: aggregation._sum.motorcycle_sessions ?? 0,
        avg_daily_revenue: Math.round(aggregation._avg.total_revenue ?? 0),
        avg_daily_sessions: Math.round(aggregation._avg.total_sessions ?? 0),
        avg_duration_min: Math.round(aggregation._avg.avg_duration_min ?? 0),
      },
    });
  } catch (err) {
    console.error('[Revenue] Summary error:', err);
    res.status(500).json({ error: 'Failed to fetch revenue summary' });
  }
});

export default router;
