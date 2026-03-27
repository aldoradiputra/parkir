-- SupaPark: rollback initial schema
-- Drop in reverse dependency order.

-- Triggers (dropped automatically with tables, but explicit for clarity)
DROP TRIGGER IF EXISTS trg_payments_updated_at         ON payments;
DROP TRIGGER IF EXISTS trg_parking_sessions_updated_at ON parking_sessions;
DROP TRIGGER IF EXISTS trg_tariff_configs_updated_at   ON tariff_configs;
DROP TRIGGER IF EXISTS trg_members_updated_at          ON members;
DROP TRIGGER IF EXISTS trg_users_updated_at            ON users;
DROP TRIGGER IF EXISTS trg_lanes_updated_at            ON lanes;
DROP TRIGGER IF EXISTS trg_locations_updated_at        ON locations;

-- Tables
DROP TABLE IF EXISTS payments         CASCADE;
DROP TABLE IF EXISTS parking_sessions CASCADE;
DROP TABLE IF EXISTS tariff_configs   CASCADE;
DROP TABLE IF EXISTS plate_rules      CASCADE;
DROP TABLE IF EXISTS members          CASCADE;
DROP TABLE IF EXISTS users            CASCADE;
DROP TABLE IF EXISTS vehicles         CASCADE;
DROP TABLE IF EXISTS lanes            CASCADE;
DROP TABLE IF EXISTS locations        CASCADE;

-- Function
DROP FUNCTION IF EXISTS set_updated_at();

-- Enum types
DROP TYPE IF EXISTS user_role;
DROP TYPE IF EXISTS session_status;
DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS payment_method;
DROP TYPE IF EXISTS lane_status;
DROP TYPE IF EXISTS lane_type;
DROP TYPE IF EXISTS vehicle_type;
