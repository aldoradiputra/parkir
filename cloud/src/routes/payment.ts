import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';
import { authMiddleware, laneAuthMiddleware, AuthRequest } from '../middleware/auth';
import { validate, qrisCreateSchema } from '../utils/validation';
import { createQrisTransaction, verifyWebhookSignature, mapTransactionStatus, checkPaymentStatus } from '../services/midtrans';
import { broadcastToDashboards, sendToLane } from '../services/websocket';

const router = Router();

/**
 * POST /api/payment/qris/create
 * Create a Midtrans QRIS transaction using the operator's server key.
 */
router.post('/qris/create', laneAuthMiddleware, validate(qrisCreateSchema), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { session_id, amount, plate } = req.body;
    const tenantId = req.tenant!.tenantId;

    // Fetch tenant's Midtrans keys
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant?.midtrans_server_key) {
      res.status(400).json({ error: 'Midtrans server key not configured for this tenant' });
      return;
    }

    // Verify session exists
    const session = await prisma.session.findUnique({
      where: { id: session_id },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const orderId = `PKR-${Date.now()}-${uuidv4().slice(0, 8)}`;

    const result = await createQrisTransaction({
      orderId,
      amount,
      serverKey: tenant.midtrans_server_key,
      itemName: `Parking - ${plate ?? 'N/A'}`,
    });

    // Update session with payment reference
    await prisma.session.update({
      where: { id: session_id },
      data: {
        payment_ref: orderId,
        payment_method: 'qris',
        payment_status: 'pending',
        fee_calculated: amount,
      },
    });

    // Extract QR string or URL from response
    const qrAction = result.actions?.find((a) => a.name === 'generate-qr-code');

    res.json({
      order_id: orderId,
      transaction_id: result.transaction_id,
      qr_string: result.qr_string ?? null,
      qr_url: qrAction?.url ?? null,
      amount,
      status: result.transaction_status,
    });
  } catch (err: any) {
    console.error('[Payment] QRIS create error:', err);
    res.status(500).json({ error: err.message ?? 'Failed to create QRIS payment' });
  }
});

/**
 * POST /api/payment/qris/webhook
 * Midtrans payment notification callback.
 */
router.post('/qris/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      transaction_id,
    } = req.body;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Find the session associated with this order
    const session = await prisma.session.findFirst({
      where: { payment_ref: order_id },
      include: { location: { include: { tenant: true } } },
    });

    if (!session) {
      console.warn(`[Payment] Webhook: session not found for order ${order_id}`);
      res.status(200).json({ status: 'ok' }); // Acknowledge to Midtrans
      return;
    }

    const serverKey = session.location.tenant.midtrans_server_key;
    if (!serverKey) {
      console.error(`[Payment] Webhook: no server key for tenant ${session.location.tenant_id}`);
      res.status(200).json({ status: 'ok' });
      return;
    }

    // Verify signature
    const isValid = verifyWebhookSignature(order_id, status_code, gross_amount, serverKey, signature_key);
    if (!isValid) {
      console.error(`[Payment] Webhook: invalid signature for order ${order_id}`);
      res.status(403).json({ error: 'Invalid signature' });
      return;
    }

    // Map status
    const paymentStatus = mapTransactionStatus(transaction_status, fraud_status);

    // Update session
    await prisma.session.update({
      where: { id: session.id },
      data: {
        payment_status: paymentStatus,
        fee_paid: paymentStatus === 'paid' ? parseInt(gross_amount, 10) : undefined,
      },
    });

    // Notify edge node via WebSocket
    if (session.lane_id) {
      sendToLane(session.lane_id, {
        event: 'payment_update',
        data: {
          session_id: session.id,
          order_id,
          transaction_id,
          status: paymentStatus,
          amount: parseInt(gross_amount, 10),
        },
      });
    }

    // Notify dashboards
    broadcastToDashboards(session.location_id, {
      event: 'payment_update',
      data: {
        session_id: session.id,
        order_id,
        status: paymentStatus,
        amount: parseInt(gross_amount, 10),
      },
    });

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Payment] Webhook error:', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * GET /api/payment/status/:ref
 * Poll payment status for a given payment reference.
 */
router.get('/status/:ref', laneAuthMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ref = req.params.ref as string;
    const tenantId = req.tenant!.tenantId;

    const session = await prisma.session.findFirst({
      where: { payment_ref: ref },
    });

    if (!session) {
      res.status(404).json({ error: 'Payment reference not found' });
      return;
    }

    // Optionally check Midtrans directly for real-time status
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    let midtransStatus = null;
    if (tenant?.midtrans_server_key) {
      try {
        midtransStatus = await checkPaymentStatus(ref, tenant.midtrans_server_key);
      } catch {
        // Fall back to DB status
      }
    }

    res.json({
      session_id: session.id,
      payment_ref: session.payment_ref,
      payment_status: session.payment_status,
      payment_method: session.payment_method,
      fee_calculated: session.fee_calculated,
      fee_paid: session.fee_paid,
      midtrans_status: midtransStatus,
    });
  } catch (err) {
    console.error('[Payment] Status check error:', err);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

export default router;
