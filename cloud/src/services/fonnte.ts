import axios from 'axios';

const FONNTE_API_URL = 'https://api.fonnte.com/send';

interface SendWhatsAppParams {
  apiKey: string;
  target: string;
  message: string;
  imageUrl?: string;
}

interface FonnteResponse {
  status: boolean;
  detail: string;
  id?: string;
}

/**
 * Send a WhatsApp message via Fonnte API.
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<FonnteResponse> {
  const { apiKey, target, message, imageUrl } = params;

  try {
    const payload: Record<string, string> = {
      target,
      message,
    };

    if (imageUrl) {
      payload.url = imageUrl;
    }

    const response = await axios.post(FONNTE_API_URL, payload, {
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    const data = response.data as FonnteResponse;

    if (!data.status) {
      console.error('[Fonnte] Send failed:', data.detail);
    }

    return data;
  } catch (err: any) {
    console.error('[Fonnte] API error:', err.response?.data ?? err.message);
    throw new Error('Failed to send WhatsApp message');
  }
}

/**
 * Build a parking receipt message.
 */
export function buildReceiptMessage(params: {
  locationName: string;
  plate: string;
  vehicleType: string;
  entryTime: Date;
  exitTime: Date;
  durationMin: number;
  fee: number;
  paymentMethod: string;
  paymentRef?: string;
}): string {
  const {
    locationName, plate, vehicleType, entryTime, exitTime,
    durationMin, fee, paymentMethod, paymentRef,
  } = params;

  const hours = Math.floor(durationMin / 60);
  const mins = durationMin % 60;
  const durationStr = hours > 0 ? `${hours}j ${mins}m` : `${mins}m`;

  const formatter = new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

  const feeFormatted = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(fee);

  return [
    `*STRUK PARKIR*`,
    ``,
    `Lokasi: ${locationName}`,
    `Plat: ${plate}`,
    `Kendaraan: ${vehicleType === 'car' ? 'Mobil' : 'Motor'}`,
    `Masuk: ${formatter.format(entryTime)}`,
    `Keluar: ${formatter.format(exitTime)}`,
    `Durasi: ${durationStr}`,
    ``,
    `*Total: ${feeFormatted}*`,
    `Pembayaran: ${paymentMethod.toUpperCase()}`,
    paymentRef ? `Ref: ${paymentRef}` : '',
    ``,
    `Terima kasih telah menggunakan layanan parkir kami.`,
  ].filter(Boolean).join('\n');
}

/**
 * Send a parking receipt via WhatsApp.
 */
export async function sendReceipt(
  apiKey: string,
  phone: string,
  receiptParams: Parameters<typeof buildReceiptMessage>[0],
): Promise<FonnteResponse> {
  const message = buildReceiptMessage(receiptParams);
  return sendWhatsApp({ apiKey, target: phone, message });
}
