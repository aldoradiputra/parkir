import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, plateRuleCreateSchema } from '../utils/validation';

const router = Router();

/**
 * GET /api/plate-rules/:locationId
 * Get all plate rules for a location.
 */
router.get('/:locationId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const locationId = req.params.locationId as string;
    const rule_type = req.query.rule_type as string | undefined;
    const plate = req.query.plate as string | undefined;

    const location = await prisma.location.findFirst({
      where: { id: locationId, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const where: any = { location_id: locationId };
    if (rule_type) where.rule_type = rule_type;
    if (plate) where.plate = { contains: plate, mode: 'insensitive' };

    const rules = await prisma.plateRule.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    res.json({ rules });
  } catch (err) {
    console.error('[PlateRules] List error:', err);
    res.status(500).json({ error: 'Failed to fetch plate rules' });
  }
});

/**
 * POST /api/plate-rules
 * Create a new plate rule.
 */
router.post('/', authMiddleware, validate(plateRuleCreateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const data = req.body;

    const location = await prisma.location.findFirst({
      where: { id: data.location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    // Check for existing rule with same plate
    const existing = await prisma.plateRule.findFirst({
      where: {
        location_id: data.location_id,
        plate: data.plate,
      },
    });

    if (existing) {
      // Update existing rule
      const rule = await prisma.plateRule.update({
        where: { id: existing.id },
        data: {
          rule_type: data.rule_type,
          reason: data.reason,
          created_by: data.created_by ?? req.tenant!.email,
        },
      });

      res.json({ rule, updated: true });
      return;
    }

    const rule = await prisma.plateRule.create({
      data: {
        ...data,
        created_by: data.created_by ?? req.tenant!.email,
      },
    });

    res.status(201).json({ rule });
  } catch (err) {
    console.error('[PlateRules] Create error:', err);
    res.status(500).json({ error: 'Failed to create plate rule' });
  }
});

/**
 * DELETE /api/plate-rules/:id
 * Delete a plate rule.
 */
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;

    const rule = await prisma.plateRule.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!rule || rule.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Plate rule not found' });
      return;
    }

    await prisma.plateRule.delete({ where: { id } });

    res.json({ success: true });
  } catch (err) {
    console.error('[PlateRules] Delete error:', err);
    res.status(500).json({ error: 'Failed to delete plate rule' });
  }
});

export default router;
