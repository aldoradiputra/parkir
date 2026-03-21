-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('mall', 'office', 'hospital', 'airport', 'residential', 'public', 'event');

-- CreateEnum
CREATE TYPE "StaffingMode" AS ENUM ('staffed', 'unstaffed', 'hybrid');

-- CreateEnum
CREATE TYPE "LaneType" AS ENUM ('entry', 'exit', 'both');

-- CreateEnum
CREATE TYPE "LaneStatus" AS ENUM ('online', 'offline', 'error');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('car', 'motorcycle');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'qris', 'nfc', 'monthly', 'free', 'waived');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'failed', 'refunded', 'waived');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('normal', 'lost_ticket', 'overnight', 'member', 'vip', 'event');

-- CreateEnum
CREATE TYPE "PassType" AS ENUM ('monthly', 'quarterly', 'yearly', 'prepaid');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('whitelist', 'blacklist', 'vip');

-- CreateEnum
CREATE TYPE "NfcCardType" AS ENUM ('emoney', 'brizzi', 'tapcash', 'flazz', 'ektp');

-- CreateEnum
CREATE TYPE "NfcStatus" AS ENUM ('pending', 'success', 'failed', 'timeout');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('gate_fault', 'revenue_anomaly', 'lane_offline', 'capacity_full', 'system_error', 'security');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "midtrans_server_key" VARCHAR(255),
    "midtrans_client_key" VARCHAR(255),
    "nfc_credentials" JSONB DEFAULT '{}',
    "whatsapp_number" VARCHAR(30),
    "fonnte_api_key" VARCHAR(255),
    "language" VARCHAR(5) NOT NULL DEFAULT 'id',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "address" TEXT,
    "city" VARCHAR(100),
    "location_type" "LocationType" NOT NULL DEFAULT 'public',
    "staffing_mode" "StaffingMode" NOT NULL DEFAULT 'unstaffed',
    "capacity_car" INTEGER NOT NULL DEFAULT 0,
    "capacity_moto" INTEGER NOT NULL DEFAULT 0,
    "tariff_config" JSONB NOT NULL DEFAULT '{}',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'Asia/Jakarta',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lanes" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lane_name" VARCHAR(100) NOT NULL,
    "lane_type" "LaneType" NOT NULL DEFAULT 'both',
    "staffing_mode" "StaffingMode" NOT NULL DEFAULT 'unstaffed',
    "api_key" VARCHAR(255) NOT NULL,
    "last_heartbeat" TIMESTAMP(3),
    "firmware_version" VARCHAR(50),
    "status" "LaneStatus" NOT NULL DEFAULT 'offline',
    "error_state" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lanes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lane_id" UUID,
    "plate" VARCHAR(20),
    "plate_raw" VARCHAR(20),
    "plate_confidence" DOUBLE PRECISION,
    "card_uid" VARCHAR(50),
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'car',
    "entry_image_url" TEXT,
    "exit_image_url" TEXT,
    "entry_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exit_time" TIMESTAMP(3),
    "duration_min" INTEGER,
    "fee_calculated" INTEGER,
    "fee_paid" INTEGER,
    "payment_method" "PaymentMethod",
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "payment_ref" VARCHAR(255),
    "session_type" "SessionType" NOT NULL DEFAULT 'normal',
    "attendant_id" VARCHAR(100),
    "override_reason" TEXT,
    "receipt_printed" BOOLEAN NOT NULL DEFAULT false,
    "receipt_whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'car',
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(30),
    "pass_type" "PassType" NOT NULL DEFAULT 'monthly',
    "balance" INTEGER NOT NULL DEFAULT 0,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plate_rules" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "plate" VARCHAR(20) NOT NULL,
    "rule_type" "RuleType" NOT NULL DEFAULT 'whitelist',
    "reason" TEXT,
    "created_by" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plate_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nfc_transactions" (
    "id" UUID NOT NULL,
    "session_id" UUID,
    "location_id" UUID NOT NULL,
    "card_uid" VARCHAR(50) NOT NULL,
    "card_type" "NfcCardType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "bank_ref" VARCHAR(255),
    "status" "NfcStatus" NOT NULL DEFAULT 'pending',
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "synced_at" TIMESTAMP(3),

    CONSTRAINT "nfc_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_revenues" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "total_revenue" INTEGER NOT NULL DEFAULT 0,
    "qris_revenue" INTEGER NOT NULL DEFAULT 0,
    "nfc_revenue" INTEGER NOT NULL DEFAULT 0,
    "monthly_revenue" INTEGER NOT NULL DEFAULT 0,
    "cash_revenue" INTEGER NOT NULL DEFAULT 0,
    "waived_amount" INTEGER NOT NULL DEFAULT 0,
    "car_sessions" INTEGER NOT NULL DEFAULT 0,
    "motorcycle_sessions" INTEGER NOT NULL DEFAULT 0,
    "avg_duration_min" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "peak_hour" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_revenues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "lane_id" UUID,
    "alert_type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_by" VARCHAR(255),
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_email_key" ON "tenants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lanes_api_key_key" ON "lanes"("api_key");

-- CreateIndex
CREATE INDEX "sessions_location_id_entry_time_idx" ON "sessions"("location_id", "entry_time");

-- CreateIndex
CREATE INDEX "sessions_plate_idx" ON "sessions"("plate");

-- CreateIndex
CREATE INDEX "sessions_payment_status_idx" ON "sessions"("payment_status");

-- CreateIndex
CREATE INDEX "sessions_card_uid_idx" ON "sessions"("card_uid");

-- CreateIndex
CREATE INDEX "members_location_id_plate_idx" ON "members"("location_id", "plate");

-- CreateIndex
CREATE INDEX "plate_rules_location_id_plate_idx" ON "plate_rules"("location_id", "plate");

-- CreateIndex
CREATE INDEX "nfc_transactions_session_id_idx" ON "nfc_transactions"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_revenues_location_id_date_key" ON "daily_revenues"("location_id", "date");

-- CreateIndex
CREATE INDEX "alerts_location_id_resolved_idx" ON "alerts"("location_id", "resolved");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lanes" ADD CONSTRAINT "lanes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plate_rules" ADD CONSTRAINT "plate_rules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_transactions" ADD CONSTRAINT "nfc_transactions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nfc_transactions" ADD CONSTRAINT "nfc_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_revenues" ADD CONSTRAINT "daily_revenues_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_lane_id_fkey" FOREIGN KEY ("lane_id") REFERENCES "lanes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

