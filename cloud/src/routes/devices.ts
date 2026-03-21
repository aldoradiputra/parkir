import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendToLane, getConnectionStats } from '../services/websocket';

const router = Router();

/**
 * GET /api/devices/connections/stats
 * Get WebSocket connection statistics.
 * NOTE: This route must be defined before /:locationId to avoid being shadowed.
 */
router.get('/connections/stats', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const stats = getConnectionStats();
    res.json({ stats });
  } catch (err) {
    console.error('[Devices] Connection stats error:', err);
    res.status(500).json({ error: 'Failed to get connection stats' });
  }
});

/**
 * GET /api/devices/:locationId
 * Get all lanes (devices) for a location.
 */
router.get('/:locationId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const locationId = req.params.locationId as string;

    const location = await prisma.location.findFirst({
      where: { id: locationId, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const lanes = await prisma.lane.findMany({
      where: { location_id: locationId },
      orderBy: { lane_name: 'asc' },
    });

    res.json({ lanes });
  } catch (err) {
    console.error('[Devices] List error:', err);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

/**
 * POST /api/devices
 * Create a new lane (device).
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const { location_id, lane_name, lane_type, staffing_mode } = req.body;

    const location = await prisma.location.findFirst({
      where: { id: location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const apiKey = `pk_${uuidv4().replace(/-/g, '')}`;

    const lane = await prisma.lane.create({
      data: {
        location_id,
        lane_name,
        lane_type: lane_type ?? 'both',
        staffing_mode: staffing_mode ?? 'unstaffed',
        api_key: apiKey,
      },
    });

    res.status(201).json({ lane });
  } catch (err) {
    console.error('[Devices] Create error:', err);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

/**
 * PUT /api/devices/:id
 * Update a lane.
 */
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;
    const { lane_name, lane_type, staffing_mode } = req.body;

    const existing = await prisma.lane.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!existing || existing.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const data: any = {};
    if (lane_name !== undefined) data.lane_name = lane_name;
    if (lane_type !== undefined) data.lane_type = lane_type;
    if (staffing_mode !== undefined) data.staffing_mode = staffing_mode;

    const lane = await prisma.lane.update({
      where: { id },
      data,
    });

    res.json({ lane });
  } catch (err) {
    console.error('[Devices] Update error:', err);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

/**
 * POST /api/devices/:id/reboot
 * Send a reboot command to an edge node.
 */
router.post('/:id/reboot', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const lane = await prisma.lane.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!lane || lane.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const sent = sendToLane(id, {
      event: 'device_command',
      data: {
        command: 'reboot',
        timestamp: new Date().toISOString(),
      },
    });

    if (!sent) {
      res.status(503).json({ error: 'Device not connected' });
      return;
    }

    res.json({ success: true, message: 'Reboot command sent' });
  } catch (err) {
    console.error('[Devices] Reboot error:', err);
    res.status(500).json({ error: 'Failed to send reboot command' });
  }
});

/**
 * POST /api/devices/:id/update-config
 * Push configuration update to an edge node.
 */
router.post('/:id/update-config', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const lane = await prisma.lane.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!lane || lane.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const sent = sendToLane(id, {
      event: 'device_command',
      data: {
        command: 'update_config',
        timestamp: new Date().toISOString(),
      },
    });

    if (!sent) {
      res.status(503).json({ error: 'Device not connected' });
      return;
    }

    res.json({ success: true, message: 'Config update command sent' });
  } catch (err) {
    console.error('[Devices] Update config error:', err);
    res.status(500).json({ error: 'Failed to send update config command' });
  }
});

/**
 * POST /api/devices/:id/regenerate-key
 * Regenerate the API key for a lane.
 */
router.post('/:id/regenerate-key', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const existing = await prisma.lane.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!existing || existing.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const newApiKey = `pk_${uuidv4().replace(/-/g, '')}`;

    const lane = await prisma.lane.update({
      where: { id },
      data: { api_key: newApiKey },
    });

    res.json({
      lane: {
        id: lane.id,
        lane_name: lane.lane_name,
        api_key: lane.api_key,
      },
      note: 'Edge node must be reconfigured with the new API key',
    });
  } catch (err) {
    console.error('[Devices] Regenerate key error:', err);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

export default router;
