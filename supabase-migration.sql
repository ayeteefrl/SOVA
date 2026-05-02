-- SOVA Wealth Terminal — Full Database Migration
-- Run this in your Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS and ADD COLUMN IF NOT EXISTS)

-- ─── Extend users table ──────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- ─── Mutual Fund SIP Schedules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_sips (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fund_name     TEXT NOT NULL,
  fund_code     TEXT,
  amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  debit_date    TEXT,                           -- "YYYY-MM-DD" for exact date
  start_date    TEXT,                           -- "YYYY-MM-DD" when SIP started
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  total_invested NUMERIC(12,2) DEFAULT 0,
  current_value  NUMERIC(12,2) DEFAULT 0,
  units          NUMERIC(14,4) DEFAULT 0,
  nav            NUMERIC(10,4),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── ETF Holdings ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_etfs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  ticker         TEXT NOT NULL,
  units          NUMERIC(14,4) NOT NULL DEFAULT 0,
  avg_cost       NUMERIC(12,4) NOT NULL DEFAULT 0,
  current_price  NUMERIC(12,4),
  expense_ratio  NUMERIC(6,4) DEFAULT 0,        -- TER as percentage
  theme          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ─── Real Estate Properties ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_real_estate (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  property_type        TEXT NOT NULL DEFAULT 'Residential',
  location             TEXT,
  purchase_price       NUMERIC(15,2) DEFAULT 0,
  current_value        NUMERIC(15,2) DEFAULT 0,
  rental_yield         NUMERIC(8,4) DEFAULT 0,
  area                 NUMERIC(10,2),
  area_unit            TEXT DEFAULT 'sqft',
  purchase_date        TEXT,
  emi                  NUMERIC(12,2) DEFAULT 0,
  loan_outstanding     NUMERIC(15,2) DEFAULT 0,
  tenant_name          TEXT,
  lease_expiry         TEXT,
  floors               TEXT,
  facing               TEXT,
  last_valuation_date  TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);

-- ─── PPF Contributions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_ppf_contributions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fy                TEXT NOT NULL,
  deposit_date      TEXT NOT NULL,
  amount            NUMERIC(10,2) NOT NULL,
  interest_for_year NUMERIC(10,2) DEFAULT 0,
  closing_balance   NUMERIC(14,2) DEFAULT 0,
  interest_rate     NUMERIC(6,4) DEFAULT 7.1,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── User Preferences ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_preferences (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  currency                    TEXT DEFAULT 'INR',
  display_format              TEXT DEFAULT 'lakh',
  gain_color                  TEXT DEFAULT '#4edea3',
  loss_color                  TEXT DEFAULT '#ffb2b7',
  live_market_data            BOOLEAN DEFAULT true,
  show_trade_rationale        BOOLEAN DEFAULT true,
  compact_view                BOOLEAN DEFAULT false,
  notifications_sip_debit     BOOLEAN DEFAULT true,
  notifications_portfolio      BOOLEAN DEFAULT true,
  notifications_market_hours  BOOLEAN DEFAULT false,
  notifications_news_digest   BOOLEAN DEFAULT true,
  created_at                  TIMESTAMPTZ DEFAULT now(),
  updated_at                  TIMESTAMPTZ DEFAULT now()
);

-- ─── Active Sessions (for Security tab) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_active_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash TEXT NOT NULL UNIQUE,
  device_name        TEXT DEFAULT 'Unknown Device',
  browser            TEXT DEFAULT 'Unknown Browser',
  ip_address         TEXT DEFAULT '0.0.0.0',
  last_active        TIMESTAMPTZ DEFAULT now(),
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ─── Manual Trades Log ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_trades (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_class     TEXT NOT NULL,
  instrument_name TEXT NOT NULL,
  ticker          TEXT,
  action          TEXT NOT NULL CHECK (action IN ('Buy','Sell','SIP','Deposit','Withdrawal','Rebalance')),
  units           NUMERIC(14,4),
  price           NUMERIC(12,4),
  amount          NUMERIC(15,2) NOT NULL,
  trade_date      TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  rationale       TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ─── PPF Rate Cache (auto-updated daily) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS ppf_rate_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate         NUMERIC(6,4) NOT NULL,
  effective_from TEXT,
  source       TEXT,
  fetched_at   TIMESTAMPTZ DEFAULT now()
);

-- Insert initial PPF rate if table is empty
INSERT INTO ppf_rate_cache (rate, effective_from, source)
SELECT 7.1, 'Q1 FY2024-25', 'Initial seed'
WHERE NOT EXISTS (SELECT 1 FROM ppf_rate_cache LIMIT 1);
