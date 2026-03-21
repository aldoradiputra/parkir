import { Router, Response } from 'express';
import { prisma } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, memberCreateSchema, memberUpdateSchema } from '../utils/validation';

const router = Router();

/**
 * GET /api/members/:locationId
 * Get all members for a location.
 */
router.get('/:locationId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const locationId = req.params.locationId as string;
    const active = req.query.active as string | undefined;
    const plate = req.query.plate as string | undefined;
    const pageStr = req.query.page as string | undefined;
    const limitStr = req.query.limit as string | undefined;

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: { id: locationId, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const where: any = { location_id: locationId };
    if (active !== undefined) where.active = active === 'true';
    if (plate) where.plate = { contains: plate, mode: 'insensitive' };

    const page = parseInt(pageStr ?? '1', 10);
    const limit = Math.min(parseInt(limitStr ?? '50', 10), 200);
    const skip = (page - 1) * limit;

    const [members, total] = await Promise.all([
      prisma.member.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.member.count({ where }),
    ]);

    res.json({
      members,
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('[Members] List error:', err);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

/**
 * POST /api/members
 * Create a new member.
 */
router.post('/', authMiddleware, validate(memberCreateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const data = req.body;

    // Verify location belongs to tenant
    const location = await prisma.location.findFirst({
      where: { id: data.location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    // Check for duplicate plate at same location
    const existing = await prisma.member.findFirst({
      where: {
        location_id: data.location_id,
        plate: data.plate,
        active: true,
      },
    });

    if (existing) {
      res.status(409).json({ error: 'An active member with this plate already exists at this location' });
      return;
    }

    const member = await prisma.member.create({
      data: {
        ...data,
        valid_from: new Date(data.valid_from),
        valid_until: new Date(data.valid_until),
      },
    });

    res.status(201).json({ member });
  } catch (err) {
    console.error('[Members] Create error:', err);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

/**
 * PUT /api/members/:id
 * Update a member.
 */
router.put('/:id', authMiddleware, validate(memberUpdateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const id = req.params.id as string;
    const data = req.body;

    // Verify member exists and belongs to tenant
    const existing = await prisma.member.findUnique({
      where: { id },
      include: { location: true },
    });

    if (!existing || existing.location.tenant_id !== tenantId) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const updateData: any = { ...data };
    if (data.valid_from) updateData.valid_from = new Date(data.valid_from);
    if (data.valid_until) updateData.valid_until = new Date(data.valid_until);

    const member = await prisma.member.update({
      where: { id },
      data: updateData,
    });

    res.json({ member });
  } catch (err) {
    console.error('[Members] Update error:', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

export default router;
