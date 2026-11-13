'use client';
// isOwner / isMember for SOVA's UI (lock icon on the Charts entry, "Open chart" on holdings). UI hints only:
// /charts, /api/hive/token and the data server all check access on the server.
import { useEffect, useState } from 'react';

export type HiveStatus = { isMember: boolean; isOwner: boolean };

// One request shared by every component on the page, refreshed after a minute (so a different account
// signing in within the same tab soon sees its own state).
let cached: { at: number; promise: Promise<HiveStatus> } | null = null;
const TTL_MS = 60_000;
const NONE: HiveStatus = { isMember: false, isOwner: false };

function load(): Promise<HiveStatus> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.promise;
  const promise = fetch('/api/hive/status', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j ? { isMember: Boolean(j.isMember), isOwner: Boolean(j.isOwner) } : NONE))
    .catch(() => {
      cached = null;
      return NONE;
    });
  cached = { at: Date.now(), promise };
  return promise;
}

/** null while loading. */
export function useHiveStatus(): HiveStatus | null {
  const [status, setStatus] = useState<HiveStatus | null>(null);
  useEffect(() => {
    let alive = true;
    load().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, []);
  return status;
}
