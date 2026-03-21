import { Router, Response } from 'express';
import { prisma, redis } from '../index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validate, tariffSettingsSchema, paymentSettingsSchema } from '../utils/validation';

const router = Router();

/**
 * PUT /api/settings/tariff
 * Update tariff configuration for a location.
 */
router.put('/tariff', authMiddleware, validate(tariffSettingsSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const { location_id, tariff_config } = req.body;

    const location = await prisma.location.findFirst({
      where: { id: location_id, tenant_id: tenantId },
    });

    if (!location) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }

    const updated = await prisma.location.update({
      where: { id: location_id },
      data: { tariff_config },
    });

    // Invalidate config cache for all lanes at this location
    const lanes = await prisma.lane.findMany({
      where: { location_id },
      select: { id: true },
    });

    const cacheKeys = lanes.map((l) => `config:${l.id}`);
    if (cacheKeys.length > 0) {
      await redis.del(...cacheKeys);
    }

    res.json({
      success: true,
      tariff_config: updated.tariff_config,
    });
  } catch (err) {
    console.error('[Settings] Tariff update error:', err);
    res.status(500).json({ error: 'Failed to update tariff settings' });
  }
});

/**
 * PUT /api/settings/payment
 * Update payment settings (Midtrans keys, NFC credentials, Fonnte).
 */
router.put('/payment', authMiddleware, validate(paymentSettingsSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.tenant!.tenantId;
    const {
      midtrans_server_key,
      midtrans_client_key,
      nfc_credentials,
      fonnte_api_key,
      whatsapp_number,
    } = req.body;

    const data: any = {};
    if (midtrans_server_key !== undefined) data.midtrans_server_key = midtrans_server_key;
    if (midtrans_client_key !== undefined) data.midtrans_client_key = midtrans_client_key;
    if (nfc_credentials !== undefined) data.nfc_credentials = nfc_credentials;
    if (fonnte_api_key !== undefined) data.fonnte_api_key = fonnte_api_key;
    if (whatsapp_number !== undefined) data.whatsapp_number = whatsapp_number;

    if (Object.keys(data).length === 0) {
      res.status(400).json({ error: 'No settings provided to update' });
      return;
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data,
      select: {
        id: true,
        midtrans_client_key: true,
        whatsapp_number: true,
        language: true,
        // Omit sensitive keys from response
      },
    });

    res.json({
      success: true,
      tenant,
      note: 'Sensitive keys are not returned in the response',
    });
  } catch (err) {
    console.error('[Settings] Payment update error:', err);
    res.status(500).json({ error: 'Failed to update payment settings' });
  }
});

export default router;
