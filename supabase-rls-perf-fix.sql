-- SOVA Wealth Terminal — RLS Performance Fix
-- Run this in your Supabase Dashboard → SQL Editor
-- Resolves all 13 "Auth RLS Initialization Plan" warnings from Performance Advisor.
--
-- Root cause: policies call auth.uid() / auth.role() directly, so Postgres
-- re-evaluates them once per row. Wrapping the call in (select ...) lets the
-- planner evaluate it once per query (an "InitPlan") instead. Same access
-- logic, just evaluated once — verified against the exact qual/with_check
-- pulled from pg_policies, so this changes performance only, not behavior.

-- ─── Owner-only tables: (auth.uid() = user_id) for both USING and WITH CHECK ──
ALTER POLICY "Users access own broker sessions" ON public.broker_sessions
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own reset tokens" ON public.password_reset_tokens
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own snapshots" ON public.portfolio_snapshots
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own sessions" ON public.user_active_sessions
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own etfs" ON public.user_etfs
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own ppf contributions" ON public.user_ppf_contributions
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own preferences" ON public.user_preferences
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own real estate" ON public.user_real_estate
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own sips" ON public.user_sips
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "Users access own trades" ON public.user_trades
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ─── users table: keyed on id, not user_id ────────────────────────────────────
ALTER POLICY "Users access own profile" ON public.users
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- ─── Public read-only tables: SELECT-only, no WITH CHECK ──────────────────────
ALTER POLICY "Authenticated users can read news" ON public.news_articles
  USING ((select auth.role()) = 'authenticated'::text);

ALTER POLICY "Authenticated users can read ppf rates" ON public.ppf_rate_cache
  USING ((select auth.role()) = 'authenticated'::text);
