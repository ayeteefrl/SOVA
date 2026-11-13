// The one Chart Hive gate. Every /charts page, the /charts layout, /api/hive/token, /api/hive/access* and
// /api/hive/status call getHiveAccess(). Identity comes only from SOVA's signed session cookie.
// Server only: it reads the cookie (next/headers) and uses the service-role Supabase client.
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { isMissingTable, resolveHiveAccess, ttlCache, type HiveAccess } from './access-core';

export type { HiveAccess, HiveRole } from './access-core';
export { hasHiveAccess, isMissingTable } from './access-core';

// A few seconds at most, so removing a member takes effect almost at once (on this server instance).
const CACHE_MS = 5000;
const existsCache = ttlCache<boolean>(CACHE_MS);
const memberCache = ttlCache<boolean>(CACHE_MS);

let warnedMissing = false;

async function userExists(userId: string) {
  const hit = existsCache.get(userId);
  if (hit !== undefined) return hit;
  const { data, error } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
  if (error) throw new Error('user lookup failed'); // fail closed, don't cache
  const ok = Boolean(data);
  existsCache.set(userId, ok);
  return ok;
}

async function isMember(userId: string) {
  const hit = memberCache.get(userId);
  if (hit !== undefined) return hit;
  const { data, error } = await supabase.from('hive_access').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      if (!warnedMissing) console.warn('[hive] hive_access table not found; no invited members until supabase-hive-access.sql is run');
      warnedMissing = true;
    } else console.error('[hive] membership lookup failed:', error.code);
    return false; // missing table or any error: not a member (the owner is unaffected)
  }
  const ok = Boolean(data);
  memberCache.set(userId, ok);
  return ok;
}

export async function getHiveAccess(): Promise<HiveAccess> {
  const session = await getSession();
  return resolveHiveAccess(session?.userId, process.env.HIVE_OWNER_USER_ID, { userExists, isMember });
}

/** Call after adding or removing a member so this instance stops serving the cached answer. */
export function forgetMembership(userId: string) {
  memberCache.delete(userId.toLowerCase());
}
