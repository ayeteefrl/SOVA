import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const FALLBACK_RATE = 7.1;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Tries to parse the PPF rate from RBI / Finance Ministry pages
async function fetchLiveRate(): Promise<{ rate: number; source: string } | null> {
  // Try multiple sources; return first successful parse
  const sources = [
    {
      url: 'https://www.nsiindia.gov.in/(S(yy2bwp55kfmjf555kyxe0n55))/InternalPage.aspx?Id_Pk=177',
      label: 'NSI India',
    },
  ];

  for (const src of sources) {
    try {
      const res = await fetch(src.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SOVA/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      // Look for pattern like "7.1%" or "7.10%"
      const match = html.match(/(\d+\.\d{1,2})\s*%/);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (parsed >= 5 && parsed <= 12) {
          return { rate: parsed, source: src.label };
        }
      }
    } catch {
      // Network error or timeout — try next source
    }
  }
  return null;
}

export async function GET() {
  // Check cache freshness
  const { data: cached } = await supabase
    .from('ppf_rate_cache')
    .select('*')
    .order('fetched_at', { ascending: false })
    .limit(1)
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ rate: cached.rate, source: cached.source, cached: true });
    }
  }

  // Cache is stale or missing — try to fetch live
  const live = await fetchLiveRate();

  if (live) {
    // Update cache
    await supabase.from('ppf_rate_cache').insert({
      rate: live.rate,
      effective_from: new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }),
      source: live.source,
    });
    return NextResponse.json({ rate: live.rate, source: live.source, cached: false });
  }

  // Fall back to last cached rate or hardcoded default
  const rate = cached?.rate ?? FALLBACK_RATE;
  return NextResponse.json({ rate, source: cached?.source ?? 'Fallback (7.1%)', cached: true });
}
