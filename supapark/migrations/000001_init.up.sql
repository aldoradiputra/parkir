-- SupaPark: initial schema
-- Requires PostgreSQL 14+ and the pgcrypto extension for gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE vehicle_type    AS ENUM ('car', 'motorcycle');
CREATE TYPE lane_type       AS ENUM ('entry', 'exit');
CREATE TYPE lane_status     AS ENUM ('active', 'inactive');
CREATE TYPE payment_method  AS ENUM ('cash', 'qris', 'member');
CREATE TYPE payment_status  AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE session_status  AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE user_role       AS ENUM ('admin', 'operator');

-- ============================================================
-- HELPER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLES
-- ============================================================

-- locations --------------------------------------------------
CREATE TABLE locations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    address    TEXT,
    timezone   TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_locations_updated_at
    BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- lanes ------------------------------------------------------
CREATE TABLE lanes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    lane_type   lane_type   NOT NULL,
    status      lane_status NOT NULL DEFAULT 'active',
    camera_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lanes_location_id ON lanes(location_id);

CREATE TRIGGER trg_lanes_updated_at
    BEFORE UPDATE ON lanes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- vehicles ---------------------------------------------------
CREATE TABLE vehicles (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plate             TEXT NOT NULL,
    plate_normalized  TEXT NOT NULL,
    vehicle_type      vehicle_type NOT NULL,
    phone             TEXT,
    phone_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    push_subscription JSONB,
    first_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    visit_count       INT NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_vehicles_plate_normalized ON vehicles(plate_normalized);
CREATE INDEX idx_vehicles_phone ON vehicles(phone) WHERE phone IS NOT NULL;

-- users ------------------------------------------------------
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id   UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'operator',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_location_id ON users(location_id);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- members ----------------------------------------------------
CREATE TABLE members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    vehicle_id  UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_members_location_vehicle ON members(location_id, vehicle_id);
CREATE INDEX idx_members_active ON members(location_id) WHERE is_active = TRUE;

CREATE TRIGGER trg_members_updated_at
    BEFORE UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- plate_rules ------------------------------------------------
CREATE TABLE plate_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    pattern      TEXT NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    priority     INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plate_rules_location_id ON plate_rules(location_id);

-- tariff_configs ---------------------------------------------
CREATE TABLE tariff_configs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id       UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    vehicle_type      vehicle_type NOT NULL,
    first_hour_rate   INT NOT NULL,
    next_hour_rate    INT NOT NULL,
    max_daily_rate    INT,
    member_month_rate INT,
    grace_period_min  INT NOT NULL DEFAULT 15,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tariff_configs_loc_type ON tariff_configs(location_id, vehicle_type);

CREATE TRIGGER trg_tariff_configs_updated_at
    BEFORE UPDATE ON tariff_configs
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- parking_sessions -------------------------------------------
CREATE TABLE parking_sessions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id      UUID NOT NULL REFERENCES locations(id),
    vehicle_id       UUID NOT NULL REFERENCES vehicles(id),
    entry_lane_id    UUID NOT NULL REFERENCES lanes(id),
    exit_lane_id     UUID REFERENCES lanes(id),
    plate            TEXT NOT NULL,
    plate_normalized TEXT NOT NULL,
    vehicle_type     vehicle_type   NOT NULL,
    entry_photo      TEXT,
    exit_photo       TEXT,
    entry_time       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    exit_time        TIMESTAMPTZ,
    duration_minutes INT,
    is_member        BOOLEAN        NOT NULL DEFAULT FALSE,
    tariff_amount    INT,
    payment_method   payment_method,
    payment_status   payment_status NOT NULL DEFAULT 'pending',
    session_status   session_status NOT NULL DEFAULT 'active',
    operator_id      UUID REFERENCES users(id),
    notes            TEXT,
    created_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_location_status ON parking_sessions(location_id, session_status);
CREATE INDEX idx_sessions_vehicle_id      ON parking_sessions(vehicle_id);
CREATE INDEX idx_sessions_plate_norm      ON parking_sessions(plate_normalized);
CREATE INDEX idx_sessions_entry_time      ON parking_sessions(entry_time);
CREATE INDEX idx_sessions_active          ON parking_sessions(location_id)
    WHERE session_status = 'active';

CREATE TRIGGER trg_parking_sessions_updated_at
    BEFORE UPDATE ON parking_sessions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- payments ---------------------------------------------------
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES parking_sessions(id) ON DELETE CASCADE,
    method          payment_method NOT NULL,
    amount          INT NOT NULL,
    order_id        TEXT NOT NULL,
    provider_txn_id TEXT,
    qr_string       TEXT,
    qr_url          TEXT,
    status          payment_status NOT NULL DEFAULT 'pending',
    webhook_payload JSONB,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_payments_order_id   ON payments(order_id);
CREATE INDEX idx_payments_session_id        ON payments(session_id);
CREATE INDEX idx_payments_status            ON payments(status);

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
