// Data tokens issued by SOVA's POST /api/hive/token: HS256, aud "hive-data", iss "sova", sub = SOVA user id,
// role owner|member, 10 minutes. Anything else (no token, bad signature, expired, wrong audience, a SOVA
// session cookie, another algorithm) is refused.
import { jwtVerify } from "jose";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyToken(secret, token) {
  if (!secret || typeof token !== "string" || token.length > 2048) throw new Error("no token");
  const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"], audience: "hive-data", issuer: "sova" });
  if (!UUID.test(String(payload.sub)) || (payload.role !== "owner" && payload.role !== "member") || typeof payload.exp !== "number")
    throw new Error("bad claims");
  return { sub: String(payload.sub).toLowerCase(), role: payload.role, exp: payload.exp };
}

export function bearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+([A-Za-z0-9_\-.]+)$/.exec(h);
  return m ? m[1] : null;
}
