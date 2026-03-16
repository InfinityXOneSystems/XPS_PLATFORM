-- XPS Intelligence Platform — Supabase schema
-- Run this in the Supabase SQL editor to initialise the leads table.
-- All scraper output and API reads/writes use this table via supabaseLeadStore.js.
--
-- The table matches the PostgreSQL schema in db/schema.sql so that data
-- migrated from the legacy PostgreSQL instance remains compatible.

-- ── Leads table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL   PRIMARY KEY,
  company_name    TEXT        NOT NULL,
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  address         TEXT,
  city            TEXT        NOT NULL DEFAULT '',
  state           TEXT        NOT NULL DEFAULT '',
  country         TEXT        NOT NULL DEFAULT 'USA',
  industry        TEXT,
  category        TEXT,
  keyword         TEXT,
  rating          NUMERIC(3,1),
  reviews         INTEGER,
  lead_score      INTEGER     DEFAULT 0,
  tier            TEXT,
  status          TEXT        DEFAULT 'new',
  source          TEXT,
  metadata        JSONB,
  date_scraped    TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_name, city, state)
);

-- Automatically update updated_at on row changes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_leads_lead_score   ON leads (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_date_scraped ON leads (date_scraped DESC);
CREATE INDEX IF NOT EXISTS idx_leads_state        ON leads (state);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_tier         ON leads (tier);

-- ── Row Level Security (optional, enable if auth is required) ─────────────
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Public read" ON leads FOR SELECT USING (true);
-- CREATE POLICY "Service role write" ON leads FOR ALL USING (auth.role() = 'service_role');
