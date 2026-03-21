import { PrismaClient, VehicleType, PaymentMethod, PaymentStatus, SessionType, PassType, RuleType, LaneType, LocationType, StaffingMode } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting...');

  // --- Tenant ---
  const passwordHash = await bcrypt.hash('password123', 10);
  const tenant = await prisma.tenant.upsert({
    where: { email: 'admin@parkir.id' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'PT Parkir Demo',
      contact_name: 'Admin Demo',
      phone: '+6281234567890',
      email: 'admin@parkir.id',
      password_hash: passwordHash,
      language: 'id',
    },
  });
  console.log('[Seed] Tenant:', tenant.email);

  // --- Location ---
  const location = await prisma.location.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      tenant_id: tenant.id,
      name: 'Mall Parkir Demo',
      address: 'Jl. Sudirman No. 1, Jakarta',
      city: 'Jakarta',
      location_type: LocationType.mall,
      staffing_mode: StaffingMode.hybrid,
      capacity_car: 100,
      capacity_moto: 200,
      tariff_config: {
        car: { first_hour: 5000, next_hour: 3000, max_daily: 50000 },
        motorcycle: { first_hour: 2000, next_hour: 1000, max_daily: 20000 },
      },
    },
  });
  console.log('[Seed] Location:', location.name);

  // --- Lanes ---
  const entryLane = await prisma.lane.upsert({
    where: { id: '00000000-0000-4000-8000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000020',
      location_id: location.id,
      lane_name: 'Gate A - Masuk',
      lane_type: LaneType.entry,
      staffing_mode: StaffingMode.unstaffed,
      api_key: 'pk_lane_entry_demo_' + randomUUID().slice(0, 8),
      status: 'online',
      last_heartbeat: new Date(),
      firmware_version: '1.2.0',
    },
  });

  const exitLane = await prisma.lane.upsert({
    where: { id: '00000000-0000-4000-8000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000021',
      location_id: location.id,
      lane_name: 'Gate B - Keluar',
      lane_type: LaneType.exit,
      staffing_mode: StaffingMode.unstaffed,
      api_key: 'pk_lane_exit_demo_' + randomUUID().slice(0, 8),
      status: 'online',
      last_heartbeat: new Date(),
      firmware_version: '1.2.0',
    },
  });
  console.log('[Seed] Lanes:', entryLane.lane_name, ',', exitLane.lane_name);

  // --- Members ---
  const now = new Date();
  const oneMonthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  await prisma.member.upsert({
    where: { id: '00000000-0000-4000-8000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000030',
      location_id: location.id,
      plate: 'B1234ABC',
      vehicle_type: VehicleType.car,
      name: 'Budi Santoso',
      phone: '+6281200001111',
      pass_type: PassType.monthly,
      valid_from: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      valid_until: oneMonthFromNow,
      active: true,
    },
  });

  await prisma.member.upsert({
    where: { id: '00000000-0000-4000-8000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000031',
      location_id: location.id,
      plate: 'B5678DEF',
      vehicle_type: VehicleType.motorcycle,
      name: 'Siti Aminah',
      phone: '+6281200002222',
      pass_type: PassType.monthly,
      valid_from: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000),
      valid_until: threeDaysFromNow,
      active: true,
    },
  });
  console.log('[Seed] Members created');

  // --- Plate Rules ---
  await prisma.plateRule.upsert({
    where: { id: '00000000-0000-4000-8000-000000000040' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000040',
      location_id: location.id,
      plate: 'B1234ABC',
      rule_type: RuleType.vip,
      reason: 'Tenant VIP member',
      created_by: 'admin@parkir.id',
    },
  });

  await prisma.plateRule.upsert({
    where: { id: '00000000-0000-4000-8000-000000000041' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000041',
      location_id: location.id,
      plate: 'B9999ZZZ',
      rule_type: RuleType.whitelist,
      reason: 'Building management',
      created_by: 'admin@parkir.id',
    },
  });
  console.log('[Seed] Plate rules created');

  // --- Sessions (mix of states) ---
  const sessions = [
    {
      id: '00000000-0000-4000-8000-000000000050',
      plate: 'B1234ABC',
      vehicle_type: VehicleType.car,
      entry_time: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      exit_time: new Date(now.getTime() - 30 * 60 * 1000),
      duration_min: 90,
      fee_calculated: 8000,
      fee_paid: 8000,
      payment_method: PaymentMethod.qris,
      payment_status: PaymentStatus.paid,
      session_type: SessionType.vip,
      lane_id: entryLane.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000051',
      plate: 'B5678DEF',
      vehicle_type: VehicleType.motorcycle,
      entry_time: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      exit_time: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      duration_min: 60,
      fee_calculated: 2000,
      fee_paid: 2000,
      payment_method: PaymentMethod.cash,
      payment_status: PaymentStatus.paid,
      session_type: SessionType.member,
      lane_id: entryLane.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000052',
      plate: 'B7777GHI',
      vehicle_type: VehicleType.car,
      entry_time: new Date(now.getTime() - 1 * 60 * 60 * 1000),
      payment_status: PaymentStatus.pending,
      session_type: SessionType.normal,
      lane_id: entryLane.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000053',
      plate: 'B3333JKL',
      vehicle_type: VehicleType.motorcycle,
      entry_time: new Date(now.getTime() - 30 * 60 * 1000),
      payment_status: PaymentStatus.pending,
      session_type: SessionType.normal,
      lane_id: entryLane.id,
    },
    {
      id: '00000000-0000-4000-8000-000000000054',
      plate: 'B9999ZZZ',
      vehicle_type: VehicleType.car,
      entry_time: new Date(now.getTime() - 5 * 60 * 60 * 1000),
      exit_time: new Date(now.getTime() - 4.5 * 60 * 60 * 1000),
      duration_min: 30,
      fee_calculated: 0,
      fee_paid: 0,
      payment_method: PaymentMethod.free,
      payment_status: PaymentStatus.waived,
      session_type: SessionType.vip,
      lane_id: entryLane.id,
    },
  ];

  for (const s of sessions) {
    await prisma.session.upsert({
      where: { id: s.id },
      update: {},
      create: {
        ...s,
        location_id: location.id,
        plate_confidence: 0.95,
      },
    });
  }
  console.log('[Seed] Sessions created:', sessions.length);

  // --- Daily Revenue (last 7 days) ---
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const id = `00000000-0000-4000-8000-0000000000${60 + i}`;
    await prisma.dailyRevenue.upsert({
      where: { location_id_date: { location_id: location.id, date } },
      update: {},
      create: {
        id,
        location_id: location.id,
        date,
        total_sessions: 50 + Math.floor(Math.random() * 30),
        total_revenue: 500000 + Math.floor(Math.random() * 300000),
        qris_revenue: 200000 + Math.floor(Math.random() * 100000),
        nfc_revenue: 50000 + Math.floor(Math.random() * 50000),
        cash_revenue: 150000 + Math.floor(Math.random() * 100000),
        monthly_revenue: 50000,
        waived_amount: 10000 + Math.floor(Math.random() * 5000),
        car_sessions: 30 + Math.floor(Math.random() * 15),
        motorcycle_sessions: 20 + Math.floor(Math.random() * 15),
        avg_duration_min: 45 + Math.random() * 30,
        peak_hour: 12 + Math.floor(Math.random() * 5),
      },
    });
  }
  console.log('[Seed] Daily revenue created (7 days)');

  console.log('[Seed] Done!');
}

main()
  .catch((e) => {
    console.error('[Seed] Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
