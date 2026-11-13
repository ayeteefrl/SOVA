// Chart Hive access rules, with no Next or Supabase imports so they can be unit-tested with mocked lookups
// (node --test tests/hive). The server wiring lives in lib/hive/access.ts.
//
// Fails closed: no owner configured, a bad owner id, a deleted account or any lookup error all mean "none".

export type HiveRole = 'owner' | 'member' | 'none';

export interface HiveAccess {
  role: HiveRole;
  /** The verified SOVA user id from the session cookie, or null when logged out. */
  userId: string | null;
  signedIn: boolean;
}

export interface HiveLookups {
  /** Does this user row still exist? (A deleted account's cookie stays valid for 30 days.) */
  userExists: (userId: string) => Promise<boolean>;
  /** Is this user on the access list? Must return false (not throw) when the table is missing. */
  isMember: (userId: string) => Promise<boolean>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

/** The owner's user id from the environment, or null if it is unset or not a UUID (then nobody gets in). */
export function ownerIdFrom(raw: string | undefined): string | null {
  const v = (raw || '').trim().toLowerCase();
  return isUuid(v) ? v : null;
}

export async function resolveHiveAccess(
  sessionUserId: string | null | undefined,
  ownerEnv: string | undefined,
  lookups: HiveLookups,
): Promise<HiveAccess> {
  if (!isUuid(sessionUserId)) return { role: 'none', userId: null, signedIn: false };
  const userId = sessionUserId.toLowerCase();
  const none: HiveAccess = { role: 'none', userId, signedIn: true };

  const owner = ownerIdFrom(ownerEnv);
  if (!owner) return none; // owner not configured: nobody, including previously invited members

  try {
    if (!(await lookups.userExists(userId))) return none;
    if (userId === owner) return { role: 'owner', userId, signedIn: true };
    return (await lookups.isMember(userId)) ? { role: 'member', userId, signedIn: true } : none;
  } catch {
    return none;
  }
}

/** Supabase/PostgREST codes for "that table isn't there" (migration not run yet). */
export function isMissingTable(err: { code?: string; message?: string } | null | undefined) {
  if (!err) return false;
  return err.code === 'PGRST205' || err.code === '42P01' || /does not exist|schema cache/i.test(err.message || '');
}

export const hasHiveAccess = (a: HiveAccess) => a.role === 'owner' || a.role === 'member';

/** A tiny time-boxed cache so a removal takes effect within `ttlMs`. */
export function ttlCache<V>(ttlMs: number, max = 5000) {
  const m = new Map<string, { v: V; exp: number }>();
  return {
    get(k: string): V | undefined {
      const e = m.get(k);
      if (!e) return undefined;
      if (e.exp < Date.now()) {
        m.delete(k);
        return undefined;
      }
      return e.v;
    },
    set(k: string, v: V) {
      if (m.size >= max) m.delete(m.keys().next().value as string);
      m.set(k, { v, exp: Date.now() + ttlMs });
    },
    delete: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}
