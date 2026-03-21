export interface TariffConfig {
  car: VehicleTariff;
  motorcycle: VehicleTariff;
  free_duration_min: number;
  grace_period_min: number;
}

export interface VehicleTariff {
  base_rate: number;
  base_duration_min: number;
  increment_rate: number;
  increment_duration_min: number;
  daily_max: number;
  overnight_fee: number;
}

/**
 * Default tariff configuration.
 */
export const DEFAULT_TARIFF: TariffConfig = {
  car: {
    base_rate: 3000,
    base_duration_min: 60,
    increment_rate: 2000,
    increment_duration_min: 60,
    daily_max: 30000,
    overnight_fee: 10000,
  },
  motorcycle: {
    base_rate: 2000,
    base_duration_min: 60,
    increment_rate: 1000,
    increment_duration_min: 60,
    daily_max: 10000,
    overnight_fee: 5000,
  },
  free_duration_min: 15,
  grace_period_min: 5,
};

export interface TariffResult {
  fee: number;
  duration_min: number;
  is_overnight: boolean;
  is_free: boolean;
  breakdown: string;
}

/**
 * Calculate parking fee based on entry/exit times, vehicle type, and tariff config.
 */
export function calculateTariff(
  entryTime: Date,
  exitTime: Date,
  vehicleType: 'car' | 'motorcycle',
  config?: Partial<TariffConfig>,
): TariffResult {
  const tariff: TariffConfig = {
    ...DEFAULT_TARIFF,
    ...config,
    car: { ...DEFAULT_TARIFF.car, ...(config?.car ?? {}) },
    motorcycle: { ...DEFAULT_TARIFF.motorcycle, ...(config?.motorcycle ?? {}) },
  };

  const durationMs = exitTime.getTime() - entryTime.getTime();
  const durationMin = Math.max(0, Math.ceil(durationMs / (1000 * 60)));

  // Free duration check
  if (durationMin <= tariff.free_duration_min) {
    return {
      fee: 0,
      duration_min: durationMin,
      is_overnight: false,
      is_free: true,
      breakdown: `Duration ${durationMin}min within free period (${tariff.free_duration_min}min)`,
    };
  }

  // Grace period: treat as if exited at base duration boundary
  const billableMin = Math.max(0, durationMin - tariff.grace_period_min);
  if (billableMin <= tariff.free_duration_min) {
    return {
      fee: 0,
      duration_min: durationMin,
      is_overnight: false,
      is_free: true,
      breakdown: `Duration ${durationMin}min within grace period`,
    };
  }

  const vehicleTariff = vehicleType === 'car' ? tariff.car : tariff.motorcycle;

  // Check overnight: entry and exit on different calendar days
  const isOvernight = entryTime.toDateString() !== exitTime.toDateString();

  let fee = 0;
  const breakdownParts: string[] = [];

  if (isOvernight) {
    // Calculate full days
    const dayDiff = Math.floor(durationMs / (1000 * 60 * 60 * 24));

    if (dayDiff >= 1) {
      // Multi-day: daily max per full day + overnight fee per night + partial day
      const fullDayFee = dayDiff * vehicleTariff.daily_max;
      const overnightFee = dayDiff * vehicleTariff.overnight_fee;
      const remainingMin = durationMin - dayDiff * 24 * 60;
      const partialFee = calculatePartialFee(remainingMin, vehicleTariff);

      fee = fullDayFee + overnightFee + partialFee;
      breakdownParts.push(
        `${dayDiff} full day(s) @ ${vehicleTariff.daily_max}`,
        `${dayDiff} overnight(s) @ ${vehicleTariff.overnight_fee}`,
        `Partial day: ${partialFee}`,
      );
    } else {
      // Single overnight stay
      const baseFee = calculatePartialFee(durationMin, vehicleTariff);
      fee = baseFee + vehicleTariff.overnight_fee;
      breakdownParts.push(
        `Parking fee: ${baseFee}`,
        `Overnight surcharge: ${vehicleTariff.overnight_fee}`,
      );
    }
  } else {
    // Same day
    fee = calculatePartialFee(durationMin, vehicleTariff);
    breakdownParts.push(`Parking fee: ${fee}`);
  }

  // Apply daily max
  if (!isOvernight && fee > vehicleTariff.daily_max) {
    fee = vehicleTariff.daily_max;
    breakdownParts.push(`Capped at daily max: ${vehicleTariff.daily_max}`);
  }

  return {
    fee,
    duration_min: durationMin,
    is_overnight: isOvernight,
    is_free: false,
    breakdown: breakdownParts.join('; '),
  };
}

/**
 * Calculate fee for a partial duration (within one day) using base + increments.
 */
function calculatePartialFee(durationMin: number, tariff: VehicleTariff): number {
  if (durationMin <= 0) return 0;

  // Base rate for the first period
  let fee = tariff.base_rate;

  // Extra minutes beyond base
  const extraMin = Math.max(0, durationMin - tariff.base_duration_min);
  if (extraMin > 0) {
    const increments = Math.ceil(extraMin / tariff.increment_duration_min);
    fee += increments * tariff.increment_rate;
  }

  // Cap at daily max
  return Math.min(fee, tariff.daily_max);
}
