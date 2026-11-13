-- SOVA Wealth Terminal — Chart Hive access list
-- Run this in your Supabase Dashboard → SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS).
--
-- Who may open /charts besides the owner. The owner is never stored here: it is the
-- HIVE_OWNER_USER_ID env var in SOVA, and if that is unset nobody gets in.
--
-- The app reads and writes this table only from server routes with the service-role key
-- (lib/supabase.ts), which bypasses RLS. RLS is enabled with NO policies, so the anon and
-- authenticated roles (the public PostgREST API) can neither read nor change it.
--
-- Removing a member DELETEs the row (no soft delete). Deleting a SOVA account removes its
-- row too (ON DELETE CASCADE).

CREATE TABLE IF NOT EXISTS hive_access (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,                  -- display only; access is decided by user_id
  added_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  note       TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK index for added_by (same advisor rule as supabase-fk-index-fix.sql).
CREATE INDEX IF NOT EXISTS idx_hive_access_added_by ON hive_access (added_by);

ALTER TABLE hive_access ENABLE ROW LEVEL SECURITY;
-- Intentionally no CREATE POLICY: deny everything to anon / authenticated.
REVOKE ALL ON TABLE hive_access FROM anon, authenticated;
