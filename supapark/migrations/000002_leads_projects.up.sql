-- SupaPark: leads & projects for customer onboarding + internal ERP

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE lead_status    AS ENUM ('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE lead_source    AS ENUM ('landing_page', 'referral', 'social_media', 'direct', 'other');
CREATE TYPE current_system AS ENUM ('manual', 'boom_gate', 'ticket', 'rfid', 'other');
CREATE TYPE project_status AS ENUM ('planning', 'procurement', 'installation', 'testing', 'live', 'maintenance', 'cancelled');

-- ============================================================
-- ADD lat/lng to locations
-- ============================================================

ALTER TABLE locations ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- ============================================================
-- LEADS
-- ============================================================

CREATE TABLE leads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Step 1: Quick form
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT NOT NULL,
    facility_name   TEXT NOT NULL,
    source          lead_source    NOT NULL DEFAULT 'landing_page',
    status          lead_status    NOT NULL DEFAULT 'new',
    -- Step 2: Full onboarding (nullable until completed)
    city            TEXT,
    address         TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    entry_lanes     INT,
    exit_lanes      INT,
    current_system  current_system,
    daily_volume    INT,
    preferred_date  DATE,
    notes           TEXT,
    -- Tracking
    onboarded_at    TIMESTAMPTZ,
    converted_at    TIMESTAMPTZ,
    project_id      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email  ON leads(email);

CREATE TRIGGER trg_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id),
    location_id     UUID REFERENCES locations(id),
    -- Facility info (copied from lead on conversion)
    facility_name   TEXT NOT NULL,
    contact_name    TEXT NOT NULL,
    contact_email   TEXT NOT NULL,
    contact_phone   TEXT NOT NULL,
    city            TEXT,
    address         TEXT,
    latitude        DOUBLE PRECISION,
    longitude       DOUBLE PRECISION,
    -- Project details
    entry_lanes     INT NOT NULL DEFAULT 1,
    exit_lanes      INT NOT NULL DEFAULT 1,
    status          project_status NOT NULL DEFAULT 'planning',
    start_date      DATE,
    target_live     DATE,
    actual_live     DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_status  ON projects(status);
CREATE INDEX idx_projects_lead_id ON projects(lead_id);

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- FK from leads.project_id → projects.id (deferred to avoid circular dependency)
ALTER TABLE leads ADD CONSTRAINT fk_leads_project
    FOREIGN KEY (project_id) REFERENCES projects(id);
