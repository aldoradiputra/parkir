import { Router, Response } from 'express';
import { prisma } from '../index';
import { laneAuthMiddleware, AuthRequest } from '../middleware/auth';
import { validate, sessionSyncSchema, heartbeatSchema } from '../utils/validation';
import { broadcastToDashboards } from '../services/websocket';

const router = Router();

/**
 * POST /api/sync
 * Bulk session sync from edge node. Creates or updates sessions.
 */
router.post('/', laneAuthMiddleware, validate(sessionSyncSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { sessions } = req.body;
    const locationId = req.locationId!;
    const laneId = req.laneId!;

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const sessionData of sessions) {
      try {
        const data = {
          location_id: locationId,
          lane_id: laneId,
          plate: sessionData.plate,
          plate_raw: sessionData.plate_raw,
          plate_confidence: sessionData.plate_confidence,
          vehicle_type: sessionData.vehicle_type,
          entry_image_url: sessionData.entry_image_url,
          exit_image_url: sessionData.exit_image_url,
          entry_time: new Date(sessionData.entry_time),
          exit_time: sessionData.exit_time ? new Date(sessionData.exit_time) : null,
          duration_min: sessionData.duration_min,
          fee_calculated: sessionData.fee_calculated,
          fee_paid: sessionData.fee_paid,
          payment_method: sessionData.payment_method,
          payment_status: sessionData.payment_status,
          payment_ref: sessionData.payment_ref,
          session_type: sessionData.session_type,
          attendant_id: sessionData.attendant_id,
          override_reason: sessionData.override_reason,
          receipt_printed: sessionData.receipt_printed,
          receipt_whatsapp: sessionData.receipt_whatsapp,
          synced_at: new Date(),
        };

        if (sessionData.id) {
          // Try update first
          const existing = await prisma.session.findUnique({ where: { id: sessionData.id } });
          if (existing) {
            await prisma.session.update({
              where: { id: sessionData.id },
              data,
            });
            results.updated++;
          } else {
            await prisma.session.create({
              data: { id: sessionData.id, ...data },
            });
            results.created++;
          }
        } else {
          await prisma.session.create({ data });
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(err.message);
      }
    }

    // Broadcast sync event to dashboards
    broadcastToDashboards(locationId, {
      event: 'session_sync',
      data: { created: results.created, updated: results.updated },
    });

    res.json({
      success: true,
      ...results,
    });
  } catch (err) {
    console.error('[Sync] Error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

/**
 * POST /api/sync/heartbeat
 * Lane status ping from edge node.
 */
router.post('/heartbeat', laneAuthMiddleware, validate(heartbeatSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const laneId = req.laneId!;
    const { firmware_version, status, error_state } = req.body;

    await prisma.lane.update({
      where: { id: laneId },
      data: {
        last_heartbeat: new Date(),
        firmware_version: firmware_version ?? undefined,
        status: status ?? 'online',
        error_state: error_state ?? null,
      },
    });

    res.json({ success: true, server_time: new Date().toISOString() });
  } catch (err) {
    console.error('[Heartbeat] Error:', err);
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

export default router;
