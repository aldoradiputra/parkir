import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../index';

const JWT_SECRET = process.env.JWT_SECRET ?? 'parkir-dev-secret';

export interface AuthPayload {
  tenantId: string;
  email: string;
}

export interface AuthRequest extends Request {
  tenant?: AuthPayload;
  laneId?: string;
  locationId?: string;
}

/**
 * JWT authentication middleware for tenant dashboard/API access.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.tenant = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * API key authentication middleware for edge nodes (lanes).
 * Expects X-API-Key header containing the lane's unique api_key.
 */
export async function laneAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    res.status(401).json({ error: 'Missing X-API-Key header' });
    return;
  }

  try {
    const lane = await prisma.lane.findUnique({
      where: { api_key: apiKey },
      include: { location: { include: { tenant: true } } },
    });

    if (!lane) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.laneId = lane.id;
    req.locationId = lane.location_id;
    req.tenant = {
      tenantId: lane.location.tenant_id,
      email: lane.location.tenant.email,
    };

    next();
  } catch (err) {
    console.error('[LaneAuth] Error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Generate a JWT token for a tenant.
 */
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
