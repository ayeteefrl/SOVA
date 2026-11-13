// How the browser reaches hive-server: directly, over https:// and wss:// (Vercel can't proxy websockets),
// at NEXT_PUBLIC_HIVE_DATA_URL, with a 10-minute token from SOVA's POST /api/hive/token.
//
// The original Chart Hive called relative /api/* paths rewritten by Next to its data server; SOVA has its
// own /api/search, /api/market, /api/stock... so every Hive request goes through hiveFetch() instead.

const RAW = (process.env.NEXT_PUBLIC_HIVE_DATA_URL || "").trim();

/** The data server's origin (scheme://host[:port]) or "" when unset/invalid. */
export const HIVE_DATA_ORIGIN = (() => {
  try {
    const u = new URL(RAW);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : "";
  } catch {
    return "";
  }
})();

export function hiveWsUrl() {
  if (!HIVE_DATA_ORIGIN) throw new Error("NEXT_PUBLIC_HIVE_DATA_URL is not set");
  return HIVE_DATA_ORIGIN.replace(/^http/, "ws") + "/stream";
}

// ---------- tokens ----------
type Tok = { token: string; expiresAt: number };
let current: Tok | null = null;
let inflight: Promise<Tok> | null = null;
const REFRESH_BEFORE_MS = 90_000; // refresh when less than 90 s are left

export class HiveAccessEnded extends Error {}

function accessEnded(status: number): never {
  // Removed from the list (403) or signed out (401): leave the Hive UI for the server-rendered page, which
  // shows the invite-only notice or SOVA's sign-in. Neither loads any Hive code, so this can't loop.
  if (typeof window !== "undefined") window.location.assign(status === 401 ? "/sign-in" : "/charts");
  throw new HiveAccessEnded(status === 401 ? "Signed out" : "Your Charts access has ended");
}

export function hiveToken(force = false): Promise<Tok> {
  if (!force && current && current.expiresAt - Date.now() > REFRESH_BEFORE_MS) return Promise.resolve(current);
  if (inflight) return inflight;
  inflight = (async () => {
    for (let attempt = 0; ; attempt++) {
      let r: Response;
      try {
        r = await fetch("/api/hive/token", { method: "POST", cache: "no-store", credentials: "same-origin" });
      } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
        continue;
      }
      if (r.status === 401 || r.status === 403) accessEnded(r.status);
      if (r.ok) {
        const j = (await r.json()) as Tok;
        current = { token: j.token, expiresAt: j.expiresAt };
        return current;
      }
      if (attempt >= 2) throw new Error(`Couldn't get a data token (HTTP ${r.status})`);
      await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** fetch() against hive-server with the data token; one retry with a fresh token on 401. */
export async function hiveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!HIVE_DATA_ORIGIN) throw new Error("The Charts data server isn't configured (NEXT_PUBLIC_HIVE_DATA_URL).");
  if (!path.startsWith("/api/")) throw new Error("hiveFetch only calls /api/* on the data server");
  const go = async (force: boolean) => {
    const { token } = await hiveToken(force);
    return fetch(HIVE_DATA_ORIGIN + path, {
      ...init,
      mode: "cors",
      credentials: "omit", // never send SOVA's cookies to the data server
      headers: { ...(init.headers || {}), Authorization: `Bearer ${token}` },
    });
  };
  const r = await go(false);
  return r.status === 401 ? go(true) : r;
}
