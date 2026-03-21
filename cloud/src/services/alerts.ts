import { prisma } from '../index';
import { broadcastToDashboards } from './websocket';

type AlertType = 'gate_fault' | 'revenue_anomaly' | 'lane_offline' | 'capacity_full' | 'system_error' | 'security';

/**
 * Create an alert and broadcast it to connected dashboards.
 */
export async function createAlert(params: {
  locationId: string;
  laneId?: string;
  alertType: AlertType;
  message: string;
}): Promise<void> {
  const { locationId, laneId, alertType, message } = params;

  try {
    const alert = await prisma.alert.create({
      data: {
        location_id: locationId,
        lane_id: laneId ?? null,
        alert_type: alertType,
        message,
      },
    });

    // Broadcast to connected dashboards
    broadcastToDashboards(locationId, {
      event: 'alert',
      data: alert,
    });

    console.log(`[Alert] ${alertType} at location ${locationId}: ${message}`);
  } catch (err) {
    console.error('[Alert] Failed to create alert:', err);
  }
}

/**
 * Check for offline lanes and create alerts.
 * A lane is considered offline if its last heartbeat was more than `thresholdMin` minutes ago.
 */
export async function checkOfflineLanes(thresholdMin: number = 5): Promise<void> {
  const threshold = new Date(Date.now() - thresholdMin * 60 * 1000);

  try {
    const offlineLanes = await prisma.lane.findMany({
      where: {
        status: 'online',
        last_heartbeat: { lt: threshold },
      },
      include: { location: true },
    });

    for (const lane of offlineLanes) {
      await prisma.lane.update({
        where: { id: lane.id },
        data: { status: 'offline' },
      });

      await createAlert({
        locationId: lane.location_id,
        laneId: lane.id,
        alertType: 'lane_offline',
        message: `Lane "${lane.lane_name}" has gone offline. Last heartbeat: ${lane.last_heartbeat?.toISOString() ?? 'never'}`,
      });
    }
  } catch (err) {
    console.error('[Alert] Offline lane check failed:', err);
  }
}

/**
 * Check for revenue anomalies compared to historical averages.
 */
export async function checkRevenueAnomalies(locationId: string): Promise<void> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get historical average
    const historicalAvg = await prisma.dailyRevenue.aggregate({
      where: {
        location_id: locationId,
        date: { gte: thirtyDaysAgo, lt: today },
      },
      _avg: { total_revenue: true, total_sessions: true },
    });

    if (!historicalAvg._avg.total_revenue || !historicalAvg._avg.total_sessions) {
      return; // Not enough data
    }

    // Get today's revenue so far
    const todayRevenue = await prisma.dailyRevenue.findUnique({
      where: {
        location_id_date: { location_id: locationId, date: today },
      },
    });

    if (!todayRevenue) return;

    const avgRevenue = historicalAvg._avg.total_revenue;
    const currentHour = new Date().getHours();

    // Project today's revenue to end-of-day (rough estimate)
    if (currentHour >= 12) {
      const projectedRevenue = (todayRevenue.total_revenue / currentHour) * 24;
      const ratio = projectedRevenue / avgRevenue;

      if (ratio < 0.5) {
        await createAlert({
          locationId,
          alertType: 'revenue_anomaly',
          message: `Revenue significantly below average. Projected: Rp ${Math.round(projectedRevenue).toLocaleString()}, Average: Rp ${Math.round(avgRevenue).toLocaleString()}`,
        });
      }
    }
  } catch (err) {
    console.error('[Alert] Revenue anomaly check failed:', err);
  }
}

/**
 * Check if a location is at or near capacity.
 */
export async function checkCapacity(locationId: string): Promise<void> {
  try {
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) return;

    // Count active sessions (entered but not exited)
    const activeSessions = await prisma.session.groupBy({
      by: ['vehicle_type'],
      where: {
        location_id: locationId,
        exit_time: null,
      },
      _count: true,
    });

    const carCount = activeSessions.find((s) => s.vehicle_type === 'car')?._count ?? 0;
    const motoCount = activeSessions.find((s) => s.vehicle_type === 'motorcycle')?._count ?? 0;

    const carCapacity = location.capacity_car;
    const motoCapacity = location.capacity_moto;

    if (carCapacity > 0 && carCount >= carCapacity * 0.95) {
      await createAlert({
        locationId,
        alertType: 'capacity_full',
        message: `Car parking near full capacity: ${carCount}/${carCapacity} (${Math.round((carCount / carCapacity) * 100)}%)`,
      });
    }

    if (motoCapacity > 0 && motoCount >= motoCapacity * 0.95) {
      await createAlert({
        locationId,
        alertType: 'capacity_full',
        message: `Motorcycle parking near full capacity: ${motoCount}/${motoCapacity} (${Math.round((motoCount / motoCapacity) * 100)}%)`,
      });
    }
  } catch (err) {
    console.error('[Alert] Capacity check failed:', err);
  }
}

/**
 * Start periodic alert checks.
 */
export function startAlertEngine(intervalMs: number = 60000): NodeJS.Timer {
  console.log(`[Alert Engine] Starting with ${intervalMs}ms interval`);

  return setInterval(async () => {
    await checkOfflineLanes();
  }, intervalMs);
}
