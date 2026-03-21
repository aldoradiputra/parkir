import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/dashboard/:locationId
 * Overview data for the dashboard: occupancy, revenue, recent sessions, alerts.
 */
router.get('/:locationId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const locationId = req.params.locationId as string;

    // Verify location
    const location = await prisma.location.findFirst({
      where: { id: locationId, tenant_id: tenantId },
      include: { lanes: true },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all queries in parallel
    const [
      activeSessions,
      todaySessions,
      todayRevenue,
      recentSessions,
      unresolvedAlerts,
      laneStatuses,
      vehicleCounts,
    ] = await Promise.all([
      // Active sessions count (vehicles currently parked)
      prisma.session.count({
        where: { location_id: locationId, exit_time: null },
      }),

      // Today's total sessions
      prisma.session.count({
        where: {
          location_id: locationId,
          entry_time: { gte: today, lt: tomorrow },
        },
      }),

      // Today's revenue
      prisma.session.aggregate({
        where: {
          location_id: locationId,
          entry_time: { gte: today, lt: tomorrow },
          payment_status: 'paid',
        },
        _sum: { fee_paid: true },
      }),

      // Recent sessions (last 10)
      prisma.session.findMany({
        where: { location_id: locationId },
        orderBy: { entry_time: 'desc' },
        take: 10,
        include: {
          lane: { select: { lane_name: true } },
        },
      }),

      // Unresolved alerts
      prisma.alert.findMany({
        where: { location_id: locationId, resolved: false },
        orderBy: { created_at: 'desc' },
        take: 20,
      }),

      // Lane statuses
      prisma.lane.findMany({
        where: { location_id: locationId },
        select: {
          id: true,
          lane_name: true,
          lane_type: true,
          status: true,
          last_heartbeat: true,
          error_state: true,
        },
      }),

      // Vehicle type breakdown for active sessions
      prisma.session.groupBy({
        by: ['vehicle_type'],
        where: { location_id: locationId, exit_time: null },
        _count: true,
      }),
    ]);

    const carCount = vehicleCounts.find((v) => v.vehicle_type === 'car');
    const motoCount = vehicleCounts.find((v) => v.vehicle_type === 'motorcycle');
    const carOccupancy = typeof carCount?._count === 'number' ? carCount._count : 0;
    const motoOccupancy = typeof motoCount?._count === 'number' ? motoCount._count : 0;

    res.json({
      location: {
        id: location.id,
        name: location.name,
        capacity_car: location.capacity_car,
        capacity_moto: location.capacity_moto,
      },
      occupancy: {
        total: activeSessions,
        car: carOccupancy,
        motorcycle: motoOccupancy,
        car_percentage: location.capacity_car > 0
          ? Math.round((carOccupancy / location.capacity_car) * 100)
          : null,
        moto_percentage: location.capacity_moto > 0
          ? Math.round((motoOccupancy / location.capacity_moto) * 100)
          : null,
      },
      today: {
        sessions: todaySessions,
        revenue: todayRevenue._sum?.fee_paid ?? 0,
      },
      recent_sessions: recentSessions,
      alerts: unresolvedAlerts,
      lanes: laneStatuses,
    });
  } catch (err) {
    console.error('[Dashboard] Error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

export default router;
