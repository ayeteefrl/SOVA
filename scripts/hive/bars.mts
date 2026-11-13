// Bars for the check scripts. From hive-server (HIVE_DATA_URL, default http://127.0.0.1:4200) with a token
// minted from HIVE_TOKEN_SECRET (local development only), or from any unauthenticated server via
// BARS_URL (e.g. the original Chart Hive on http://127.0.0.1:4100, to compare on identical bars).
import { SignJWT } from "jose";

export async function bars(symbol: string, tf: string, limit: number) {
  const plain = process.env.BARS_URL;
  const base = plain || process.env.HIVE_DATA_URL || "http://127.0.0.1:4200";
  const headers: Record<string, string> = {};
  if (!plain) {
    const secret = process.env.HIVE_TOKEN_SECRET;
    if (!secret) throw new Error("Set HIVE_TOKEN_SECRET (same as hive-server's) or BARS_URL");
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ role: "owner" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("00000000-0000-4000-8000-000000000000")
      .setAudience("hive-data")
      .setIssuer("sova")
      .setExpirationTime(now + 300)
      .sign(new TextEncoder().encode(secret));
    headers.Authorization = `Bearer ${token}`;
  }
  const r = await fetch(`${base}/api/bars?symbol=${encodeURIComponent(symbol)}&tf=${tf}&limit=${limit}`, { headers });
  if (!r.ok) throw new Error(`bars ${symbol} ${tf}: HTTP ${r.status}`);
  return (await r.json()).candles;
}
