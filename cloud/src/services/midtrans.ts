import crypto from 'crypto';
import axios from 'axios';

const MIDTRANS_BASE_URL = process.env.MIDTRANS_ENV === 'production'
  ? 'https://api.midtrans.com'
  : 'https://api.sandbox.midtrans.com';

interface QrisCreateParams {
  orderId: string;
  amount: number;
  serverKey: string;
  itemName?: string;
  customerName?: string;
}

interface QrisResponse {
  status_code: string;
  status_message: string;
  transaction_id: string;
  order_id: string;
  gross_amount: string;
  payment_type: string;
  transaction_status: string;
  actions?: Array<{
    name: string;
    method: string;
    url: string;
  }>;
  qr_string?: string;
}

/**
 * Create a QRIS payment transaction via Midtrans.
 */
export async function createQrisTransaction(params: QrisCreateParams): Promise<QrisResponse> {
  const { orderId, amount, serverKey, itemName, customerName } = params;

  const auth = Buffer.from(`${serverKey}:`).toString('base64');

  const payload = {
    payment_type: 'qris',
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: 'parking-fee',
        price: amount,
        quantity: 1,
        name: itemName ?? 'Parking Fee',
      },
    ],
    customer_details: {
      first_name: customerName ?? 'Parkir Customer',
    },
    qris: {
      acquirer: 'gopay',
    },
  };

  try {
    const response = await axios.post(`${MIDTRANS_BASE_URL}/v2/charge`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    return response.data as QrisResponse;
  } catch (err: any) {
    const errorData = err.response?.data;
    console.error('[Midtrans] QRIS creation failed:', errorData ?? err.message);
    throw new Error(errorData?.status_message ?? 'Failed to create QRIS transaction');
  }
}

/**
 * Check payment status from Midtrans.
 */
export async function checkPaymentStatus(orderId: string, serverKey: string): Promise<any> {
  const auth = Buffer.from(`${serverKey}:`).toString('base64');

  try {
    const response = await axios.get(`${MIDTRANS_BASE_URL}/v2/${orderId}/status`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
      },
      timeout: 15000,
    });

    return response.data;
  } catch (err: any) {
    console.error('[Midtrans] Status check failed:', err.response?.data ?? err.message);
    throw new Error('Failed to check payment status');
  }
}

/**
 * Verify Midtrans webhook signature.
 * Signature key = SHA512(order_id + status_code + gross_amount + server_key)
 */
export function verifyWebhookSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string,
): boolean {
  const input = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const expected = crypto.createHash('sha512').update(input).digest('hex');
  return expected === signatureKey;
}

/**
 * Map Midtrans transaction status to our payment status.
 */
export function mapTransactionStatus(transactionStatus: string, fraudStatus?: string): 'paid' | 'pending' | 'failed' {
  if (transactionStatus === 'capture') {
    return fraudStatus === 'accept' ? 'paid' : 'pending';
  }

  switch (transactionStatus) {
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'expire':
      return 'failed';
    default:
      return 'pending';
  }
}
