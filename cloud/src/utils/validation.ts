import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// --- Auth ---
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// --- Session sync ---
export const sessionSyncSchema = z.object({
  sessions: z.array(z.object({
    id: z.string().uuid().optional(),
    plate: z.string().max(20).optional().nullable(),
    plate_raw: z.string().max(20).optional().nullable(),
    plate_confidence: z.number().min(0).max(1).optional().nullable(),
    vehicle_type: z.enum(['car', 'motorcycle']).default('car'),
    entry_image_url: z.string().optional().nullable(),
    exit_image_url: z.string().optional().nullable(),
    entry_time: z.string().datetime(),
    exit_time: z.string().datetime().optional().nullable(),
    duration_min: z.number().int().optional().nullable(),
    fee_calculated: z.number().int().optional().nullable(),
    fee_paid: z.number().int().optional().nullable(),
    payment_method: z.enum(['cash', 'qris', 'nfc', 'monthly', 'free', 'waived']).optional().nullable(),
    payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'waived']).default('pending'),
    payment_ref: z.string().optional().nullable(),
    session_type: z.enum(['normal', 'lost_ticket', 'overnight', 'member', 'vip', 'event']).default('normal'),
    attendant_id: z.string().optional().nullable(),
    override_reason: z.string().optional().nullable(),
    receipt_printed: z.boolean().default(false),
    receipt_whatsapp: z.boolean().default(false),
  })),
});

// --- Heartbeat ---
export const heartbeatSchema = z.object({
  firmware_version: z.string().optional(),
  status: z.enum(['online', 'offline', 'error']).default('online'),
  error_state: z.string().optional().nullable(),
});

// --- Payment ---
export const qrisCreateSchema = z.object({
  session_id: z.string().uuid(),
  amount: z.number().int().positive('Amount must be positive'),
  vehicle_type: z.enum(['car', 'motorcycle']).optional(),
  plate: z.string().max(20).optional(),
});

// --- NFC ---
export const nfcDeductSchema = z.object({
  session_id: z.string().uuid().optional(),
  card_uid: z.string().min(1),
  card_type: z.enum(['emoney', 'brizzi', 'tapcash', 'flazz']),
  amount: z.number().int().positive(),
});

// --- Members ---
export const memberCreateSchema = z.object({
  location_id: z.string().uuid(),
  plate: z.string().min(1).max(20),
  vehicle_type: z.enum(['car', 'motorcycle']).default('car'),
  name: z.string().min(1).max(255),
  phone: z.string().max(30).optional().nullable(),
  pass_type: z.enum(['monthly', 'quarterly', 'yearly', 'prepaid']).default('monthly'),
  balance: z.number().int().default(0),
  valid_from: z.string().datetime(),
  valid_until: z.string().datetime(),
});

export const memberUpdateSchema = memberCreateSchema.partial().omit({ location_id: true });

// --- Plate rules ---
export const plateRuleCreateSchema = z.object({
  location_id: z.string().uuid(),
  plate: z.string().min(1).max(20),
  rule_type: z.enum(['whitelist', 'blacklist', 'vip']).default('whitelist'),
  reason: z.string().optional().nullable(),
  created_by: z.string().optional().nullable(),
});

// --- Gate ---
export const gateCommandSchema = z.object({
  lane_id: z.string().uuid(),
  reason: z.string().optional(),
});

// --- Settings ---
export const tariffSettingsSchema = z.object({
  location_id: z.string().uuid(),
  tariff_config: z.object({
    car: z.object({
      base_rate: z.number().int(),
      base_duration_min: z.number().int(),
      increment_rate: z.number().int(),
      increment_duration_min: z.number().int(),
      daily_max: z.number().int(),
      overnight_fee: z.number().int(),
    }),
    motorcycle: z.object({
      base_rate: z.number().int(),
      base_duration_min: z.number().int(),
      increment_rate: z.number().int(),
      increment_duration_min: z.number().int(),
      daily_max: z.number().int(),
      overnight_fee: z.number().int(),
    }),
    free_duration_min: z.number().int(),
    grace_period_min: z.number().int(),
  }),
});

export const paymentSettingsSchema = z.object({
  midtrans_server_key: z.string().optional(),
  midtrans_client_key: z.string().optional(),
  nfc_credentials: z.record(z.any()).optional(),
  fonnte_api_key: z.string().optional(),
  whatsapp_number: z.string().optional(),
});

// --- Session query ---
export const sessionQuerySchema = z.object({
  location_id: z.string().uuid().optional(),
  plate: z.string().optional(),
  vehicle_type: z.enum(['car', 'motorcycle']).optional(),
  payment_method: z.enum(['cash', 'qris', 'nfc', 'monthly', 'free', 'waived']).optional(),
  payment_status: z.enum(['pending', 'paid', 'failed', 'refunded', 'waived']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Validation middleware factory ---
export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    req.query = result.data;
    next();
  };
}
