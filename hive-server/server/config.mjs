// Everything the server's behaviour depends on comes from environment variables, so it runs the same on
// Fly.io, a VPS or a laptop. Nothing here is host-specific.
//
//   HOST                  interface to bind (default 127.0.0.1; 0.0.0.0 in a container)
//   PORT                  port (DATA_PORT still works; default 4200 so the original app can keep 4100)
//   QT_DATA_DIR           writable data folder (caches, deals history, optional feeds.json)
//   HIVE_SEED_DIR         read-only seed files copied into QT_DATA_DIR when missing (default ./seed)
//   ALLOWED_ORIGINS       comma-separated browser origins allowed by CORS and the websocket
//   HIVE_TOKEN_SECRET     shared with SOVA (>= 32 chars); the server refuses to start without it
//   TRUST_PROXY           "fly" (Fly-Client-IP), "xff" (last X-Forwarded-For hop) or "none" (default)
//   UPSTOX_ANALYTICS_TOKEN  optional; read by upstox.mjs

import path from "node:path";

export const MIN_SECRET_LENGTH = 32;

export function originList(raw) {
  const out = new Set();
  for (const part of String(raw || "").split(",")) {
    const s = part.trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if (u.protocol !== "https:" && u.protocol !== "http:") continue;
      out.add(u.origin); // normalised: scheme://host[:port], no path or trailing slash
    } catch {
      /* ignore malformed entries */
    }
  }
  return out;
}

export function loadConfig(env = process.env, root = process.cwd()) {
  const port = Number(env.PORT || env.DATA_PORT) || 4200;
  const secret = String(env.HIVE_TOKEN_SECRET || "").trim();
  const trust = String(env.TRUST_PROXY || "none").toLowerCase();
  return {
    host: env.HOST || "127.0.0.1",
    port,
    dataDir: env.QT_DATA_DIR || path.join(root, "data"),
    seedDir: env.HIVE_SEED_DIR || path.join(root, "seed"),
    origins: originList(env.ALLOWED_ORIGINS),
    secret: secret.length >= MIN_SECRET_LENGTH ? new TextEncoder().encode(secret) : null,
    trustProxy: ["fly", "xff"].includes(trust) ? trust : "none",
  };
}
