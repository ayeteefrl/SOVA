// Request hygiene: client IP behind a proxy, rate limits, and strict query-parameter parsing.

// ---------- client IP ----------
// Only trust proxy headers when told the server runs behind that proxy (TRUST_PROXY), otherwise anyone
// could pick their own rate-limit key by sending the header.
export function clientIp(req, trustProxy) {
  if (trustProxy === "fly") {
    const v = req.headers["fly-client-ip"];
    if (typeof v === "string" && v.length <= 64) return v.trim();
  } else if (trustProxy === "xff") {
    const v = req.headers["x-forwarded-for"];
    if (typeof v === "string") {
      const hops = v.split(",").map((s) => s.trim()).filter(Boolean);
      if (hops.length && hops.at(-1).length <= 64) return hops.at(-1); // the hop our proxy appended
    }
  }
  return req.socket?.remoteAddress || "unknown";
}

// ---------- token buckets ----------
// `capacity` requests at once, refilled continuously at `capacity` per `windowMs`.
export class Limiter {
  constructor(capacity, windowMs) {
    this.capacity = capacity;
    this.rate = capacity / windowMs;
    this.buckets = new Map();
    this.sweep = setInterval(() => this.prune(), 60e3);
    this.sweep.unref?.();
  }
  take(key, cost = 1) {
    const now = Date.now();
    let b = this.buckets.get(key);
    if (!b) this.buckets.set(key, (b = { tokens: this.capacity, t: now }));
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.t) * this.rate);
    b.t = now;
    if (b.tokens < cost) return { ok: false, retryAfter: Math.max(1, Math.ceil((cost - b.tokens) / this.rate / 1000)) };
    b.tokens -= cost;
    return { ok: true, retryAfter: 0 };
  }
  prune() {
    const now = Date.now();
    for (const [k, b] of this.buckets) if (b.tokens + (now - b.t) * this.rate >= this.capacity) this.buckets.delete(k);
  }
  stop() {
    clearInterval(this.sweep);
  }
}

// ---------- parameter parsing ----------
export class BadInput extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.expose = true;
  }
}

const SYMBOL = /^[A-Za-z0-9:._\-&^=!/ ]{1,40}$/;
const TF = /^\d{1,3}[smhDWM]$/;

export function intParam(q, name, { def, min, max }) {
  const raw = q.get(name);
  if (raw == null || raw === "") return def;
  if (!/^\d{1,7}$/.test(raw)) throw new BadInput(`${name} must be a whole number`);
  return Math.max(min, Math.min(max, Number(raw)));
}

export function symbolParam(q, name = "symbol", { required = true } = {}) {
  const v = (q.get(name) || "").trim();
  if (!v) {
    if (required) throw new BadInput(`${name} is required`);
    return "";
  }
  if (!SYMBOL.test(v)) throw new BadInput(`Invalid ${name}`);
  return v;
}

export function tfParam(q, def = "1D") {
  const v = q.get("tf") || def;
  if (!TF.test(v)) throw new BadInput("Invalid timeframe");
  return v;
}

export function listParam(q, name, max = 300) {
  const raw = q.get(name) || "";
  if (raw.length > max * 42) throw new BadInput(`Too many ${name}`);
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length > max) throw new BadInput(`At most ${max} ${name}`);
  for (const s of list) if (!SYMBOL.test(s) && !/^[A-Za-z0-9&\-.…]{1,40}$/.test(s)) throw new BadInput(`Invalid entry in ${name}`);
  return list;
}

export function textParam(q, name, max = 64) {
  const v = q.get(name) || "";
  if (v.length > max) throw new BadInput(`${name} is too long`);
  return v.replace(/[\u0000-\u001f\u007f]/g, "");
}

export const validSymbol = (s) => typeof s === "string" && SYMBOL.test(s);
export const validTf = (s) => typeof s === "string" && TF.test(s);
