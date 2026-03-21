import { Router, Response } from 'express';
import axios from 'axios';
import { prisma } from '../index';
import { laneAuthMiddleware, AuthRequest } from '../middleware/auth';
import { validate, nfcDeductSchema } from '../utils/validation';
import { broadcastToDashboards, sendToLane } from '../services/websocket';

const router = Router();

/**
 * POST /api/nfc/deduct
 * Proxy NFC deduction request to bank merchant API.
 */
router.post('/deduct', laneAuthMiddleware, validate(nfcDeductSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { session_id, card_uid, card_type, amount } = req.body;
    const locationId = req.locationId!;
    const tenantId = req.tenant!.tenantId;

    // Fetch tenant's NFC credentials
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.nfc_credentials) {
      res.status(400).json({ error: 'NFC credentials not configured' });
      return;
    }

    const nfcCreds = tenant.nfc_credentials as Record<string, any>;

    // Create NFC transaction record
    const nfcTx = await prisma.nfcTransaction.create({
      data: {
        session_id: session_id ?? null,
        location_id: locationId,
        card_uid,
        card_type,
        amount,
        status: 'pending',
      },
    });

    try {
      // Proxy to bank merchant API
      // The actual API endpoint and payload format depends on the NFC card issuer
      const merchantApiUrl = nfcCreds.api_url as string;
      const merchantApiKey = nfcCreds.api_key as string;
      const merchantId = nfcCreds.merchant_id as string;

      if (!merchantApiUrl || !merchantApiKey) {
        throw new Error('NFC merchant API not properly configured');
      }

      const bankResponse = await axios.post(merchantApiUrl, {
        merchant_id: merchantId,
        card_uid,
        card_type,
        amount,
        transaction_id: nfcTx.id,
        timestamp: new Date().toISOString(),
      }, {
        headers: {
          Authorization: `Bearer ${merchantApiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      });

      const bankData = bankResponse.data;

      // Update NFC transaction
      await prisma.nfcTransaction.update({
        where: { id: nfcTx.id },
        data: {
          status: 'success',
          bank_ref: bankData.reference ?? bankData.ref_number ?? null,
          synced_at: new Date(),
        },
      });

      // Update session payment if session_id provided
      if (session_id) {
        await prisma.session.update({
          where: { id: session_id },
          data: {
            payment_method: 'nfc',
            payment_status: 'paid',
            fee_paid: amount,
            payment_ref: bankData.reference ?? nfcTx.id,
          },
        });
      }

      // Notify
      broadcastToDashboards(locationId, {
        event: 'nfc_payment',
        data: {
          transaction_id: nfcTx.id,
          session_id,
          card_type,
          amount,
          status: 'success',
        },
      });

      res.json({
        success: true,
        transaction_id: nfcTx.id,
        bank_ref: bankData.reference ?? null,
        status: 'success',
        amount,
      });
    } catch (bankErr: any) {
      // Bank API failed
      await prisma.nfcTransaction.update({
        where: { id: nfcTx.id },
        data: { status: 'failed' },
      });

      console.error('[NFC] Bank API error:', bankErr.response?.data ?? bankErr.message);
      res.status(502).json({
        error: 'NFC deduction failed at bank',
        transaction_id: nfcTx.id,
        status: 'failed',
      });
    }
  } catch (err) {
    console.error('[NFC] Deduct error:', err);
    res.status(500).json({ error: 'NFC deduction failed' });
  }
});

export default router;
