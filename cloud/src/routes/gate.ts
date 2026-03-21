import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, gateCommandSchema } from '../utils/validation';
import { sendToLane, broadcastToDashboards } from '../services/websocket';

const router = Router();

/**
 * POST /api/gate/open
 * Remote gate open command via WebSocket to edge node.
 */
router.post('/open', authMiddleware, validate(gateCommandSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lane_id, reason } = req.body;
    const tenantId = req.tenant!.tenantId;

    // Verify lane belongs to tenant
    const lane = await prisma.lane.findUnique({
      where: { id: lane_id },
      include: { location: true },
    });

    if (!lane || lane.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Lane not found' });
      return;
    }

    if (lane.status === 'offline') {
      res.status(400).json({ error: 'Lane is offline' });
      return;
    }

    // Send command to edge node
    const sent = sendToLane(lane_id, {
      event: 'gate_command',
      data: {
        command: 'open',
        reason: reason ?? 'Remote open by operator',
        timestamp: new Date().toISOString(),
      },
    });

    if (!sent) {
      res.status(503).json({ error: 'Lane not connected via WebSocket' });
      return;
    }

    // Broadcast to dashboards
    broadcastToDashboards(lane.location_id, {
      event: 'gate_command',
      data: {
        lane_id,
        lane_name: lane.lane_name,
        command: 'open',
        by: req.tenant!.email,
        reason,
      },
    });

    res.json({ success: true, message: 'Gate open command sent' });
  } catch (err) {
    console.error('[Gate] Open error:', err);
    res.status(500).json({ error: 'Failed to open gate' });
  }
});

/**
 * POST /api/gate/close
 * Remote gate close command via WebSocket to edge node.
 */
router.post('/close', authMiddleware, validate(gateCommandSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { lane_id, reason } = req.body;
    const tenantId = req.tenant!.tenantId;

    const lane = await prisma.lane.findUnique({
      where: { id: lane_id },
      include: { location: true },
    });

    if (!lane || lane.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Lane not found' });
      return;
    }

    if (lane.status === 'offline') {
      res.status(400).json({ error: 'Lane is offline' });
      return;
    }

    const sent = sendToLane(lane_id, {
      event: 'gate_command',
      data: {
        command: 'close',
        reason: reason ?? 'Remote close by operator',
        timestamp: new Date().toISOString(),
      },
    });

    if (!sent) {
      res.status(503).json({ error: 'Lane not connected via WebSocket' });
      return;
    }

    broadcastToDashboards(lane.location_id, {
      event: 'gate_command',
      data: {
        lane_id,
        lane_name: lane.lane_name,
        command: 'close',
        by: req.tenant!.email,
        reason,
      },
    });

    res.json({ success: true, message: 'Gate close command sent' });
  } catch (err) {
    console.error('[Gate] Close error:', err);
    res.status(500).json({ error: 'Failed to close gate' });
  }
});

export default router;
