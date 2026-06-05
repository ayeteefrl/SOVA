import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { derivePPFCorpus, type Contribution } from '@/lib/ppf';

const FALLBACK_RATE = 7.1;

/**
 * GET /api/ppf/corpus
 * Returns the current PPF corpus value along with deposited and interest
 * breakdown, so the home / dashboard pages can include PPF in net worth.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [contribRes, rateRes] = await Promise.all([
    supabase
      .from('user_ppf_contributions')
      .select('*')
      .eq('user_id', session.userId)
      .order('deposit_date', { ascending: true }),
    supabase
      .from('ppf_rate_cache')
      .select('rate')
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  const contributions: Contribution[] = contribRes.data ?? [];
  const rate: number = rateRes.data?.rate ?? FALLBACK_RATE;

  const { corpus, totalDeposited, totalInterest } = derivePPFCorpus(contributions, rate);

  return NextResponse.json({ corpus, totalDeposited, totalInterest, rate });
}
