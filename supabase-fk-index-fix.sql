-- SOVA Wealth Terminal — Unindexed Foreign Key Fix
-- Run this in your Supabase Dashboard → SQL Editor
-- Resolves the 6 "Unindexed foreign keys" INFO lints from Performance Advisor.
--
-- These user_id columns are exactly what RLS policies filter on
-- (auth.uid() = user_id), so every per-user query and join benefits.
-- Safe to run multiple times (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_user_active_sessions_user_id ON public.user_active_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_etfs_user_id ON public.user_etfs (user_id);
CREATE INDEX IF NOT EXISTS idx_user_ppf_contributions_user_id ON public.user_ppf_contributions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_real_estate_user_id ON public.user_real_estate (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sips_user_id ON public.user_sips (user_id);
CREATE INDEX IF NOT EXISTS idx_user_trades_user_id ON public.user_trades (user_id);
