// /charts?symbol=EXCHANGE:TICKER: format check on the server (the data server then confirms it exists).
// Shared with SOVA's "Open chart" links, which build the same format.

const PARAM = /^[A-Z]{2,10}:[A-Z0-9&._\-!^=]{1,30}$/;

export function parseSymbolParam(v: string | string[] | undefined): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toUpperCase();
  return PARAM.test(s) ? s : null;
}

/**
 * NSE ticker from a SOVA holding's ticker, or null if it can't be one (no ticker, an ISIN, a fund name).
 * Handles broker formats: "RELIANCE" (Zerodha, Upstox, Groww), "RELIANCE-EQ" (Angel One), "XYZ-BE" (other
 * series), "RELIANCE.NS" / ".BO" (Yahoo-style custom entries), "NSE:INFY", and tickers like "M&M" or "BAJAJ-AUTO".
 * BSE-only companies still work: the terminal retries NSE:X as BSE:X when NSE doesn't list it.
 */
export function nseTickerFrom(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let t = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  t = t.replace(/^(NSE|BSE):/, '').replace(/\.(NS|BO)$/, '').replace(/-(EQ|BE|BZ|SM|ST)$/, '');
  if (/^IN[A-Z0-9]{10}$/.test(t)) return null; // an ISIN, not a ticker
  return /^[A-Z0-9&\-]{1,20}$/.test(t) && /[A-Z]/.test(t) ? t : null;
}

export const chartHref = (ticker: string) => `/charts?symbol=${encodeURIComponent(`NSE:${ticker}`)}`;
