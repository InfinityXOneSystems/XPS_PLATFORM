-- ============================================================
-- XPS Intelligence — Supabase leads table migration
-- ============================================================
-- Run this ONCE in the Supabase SQL Editor BEFORE configuring
-- the Database Webhook.
--
-- Why: Supabase only shows the `public` schema in the webhook
-- "Conditions to fire webhook" dropdown when at least one
-- user-created table exists in that schema.  Running this SQL
-- creates the `leads` table in `public`, making `public`
-- visible as a schema option so you can select:
--   Schema → public   Table → leads
--
-- Steps:
--   1. Go to https://nxfbfbipjsfzoefpgrof.supabase.co
--   2. Navigate to SQL Editor (left sidebar)
--   3. Click "New query"
--   4. Paste this entire file and click "Run" (Ctrl+Enter)
--   5. Confirm you see "Success. No rows returned."
--   6. Now go to Database → Webhooks and configure the trigger.
-- ============================================================

-- Core leads table
CREATE TABLE IF NOT EXISTS public.leads (
  id              BIGSERIAL   PRIMARY KEY,
  company_name    TEXT        NOT NULL,
  contact_name    TEXT,
  phone           TEXT,
  email           TEXT,
  website         TEXT,
  address         TEXT,
  city            TEXT        NOT NULL DEFAULT '',
  state           TEXT        NOT NULL DEFAULT '',
  country         TEXT        NOT NULL DEFAULT 'US',
  industry        TEXT,
  category        TEXT,
  keyword         TEXT,
  linkedin        TEXT,
  rating          NUMERIC(3,1),
  reviews         INTEGER,
  lead_score      INTEGER     DEFAULT 0,
  tier            TEXT,
  status          TEXT        DEFAULT 'new',
  source          TEXT,
  metadata        JSONB,
  date_scraped    TIMESTAMPTZ DEFAULT NOW(),
  last_contacted  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_name, city, state)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_leads_lead_score   ON public.leads (lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_date_scraped ON public.leads (date_scraped DESC);
CREATE INDEX IF NOT EXISTS idx_leads_state        ON public.leads (state);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_tier         ON public.leads (tier);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON public.leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable Row Level Security (Supabase best practice)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow the service-role key (used by backend) full access.
-- The service_role key is a server-side secret that bypasses RLS by default;
-- this explicit policy documents the intent and ensures it works with RLS enabled.
-- The anon / authenticated roles do NOT have a policy and therefore cannot access
-- leads rows directly — all client requests must go through the backend API.
CREATE POLICY IF NOT EXISTS "service_role full access"
  ON public.leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
