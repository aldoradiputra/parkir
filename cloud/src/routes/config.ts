import { Router, Response } from 'express';
import { prisma, redis } from '../index';
import { laneAuthMiddleware, AuthRequest } from '../middleware/auth';
import { DEFAULT_TARIFF } from '../services/tariff';

const router = Router();

const CONFIG_CACHE_TTL = 300; // 5 minutes

/**
 * GET /api/config/:laneId
 * Pull tariff, whitelist, and member data for an edge node.
 */
router.get('/:laneId', laneAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { laneId } = req.params;
    const locationId = req.locationId!;

    // Check Redis cache
    const cacheKey = `config:${laneId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    // Fetch location with tariff config
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    // Fetch plate rules (whitelist/blacklist/vip)
    const plateRules = await prisma.plateRule.findMany({
      where: { location_id: locationId },
      select: {
        plate: true,
        rule_type: true,
      },
    });

    // Fetch active members
    const members = await prisma.member.findMany({
      where: {
        location_id: locationId,
        active: true,
        valid_until: { gte: new Date() },
      },
      select: {
        plate: true,
        vehicle_type: true,
        name: true,
        pass_type: true,
        balance: true,
        valid_until: true,
      },
    });

    // Build tariff config (merge defaults with location overrides)
    const tariffRaw = location.tariff_config as Record<string, any> | null;
    const tariffConfig = tariffRaw && Object.keys(tariffRaw).length > 0
      ? tariffRaw
      : DEFAULT_TARIFF;

    const config = {
      location: {
        id: location.id,
        name: location.name,
        location_type: location.location_type,
        staffing_mode: location.staffing_mode,
        capacity_car: location.capacity_car,
        capacity_moto: location.capacity_moto,
        timezone: location.timezone,
      },
      tariff: tariffConfig,
      plate_rules: plateRules,
      members: members,
      server_time: new Date().toISOString(),
    };

    // Cache the config
    await redis.setex(cacheKey, CONFIG_CACHE_TTL, JSON.stringify(config));

    res.json(config);
  } catch (err) {
    console.error('[Config] Error:', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export default router;
