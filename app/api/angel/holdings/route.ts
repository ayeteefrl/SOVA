import { NextResponse } from 'next/server';
import {
  getAngelAuthToken,
  fetchAngelHoldings,
  shouldRefreshAngel,
  refreshAngelToken,
} from '@/lib/angel-client';
import { getSession } from '@/lib/session';
import type { Holding } from '@/lib/data';

export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let authToken = await getAngelAuthToken(session.userId);
  if (!authToken) {
    return NextResponse.json({ error: 'reconnect_required' }, { status: 401 });
  }

  // Silent refresh if token is stale
  if (await shouldRefreshAngel(session.userId)) {
    const ok = await refreshAngelToken(session.userId);
    if (ok) authToken = (await getAngelAuthToken(session.userId)) ?? authToken;
  }

  try {
    const data = await fetchAngelHoldings(authToken);
    const raw: any[] = data?.holdings ?? [];

    const holdings: Holding[] = raw.map((h: any, i: number) => {
      const ltp      = h.ltp ?? 0;
      const close    = h.close ?? ltp;
      const qty      = h.quantity ?? 0;
      const avgCost  = h.averageprice ?? 0;
      const value    = ltp * qty;
      const daily    = close > 0 ? ((ltp - close) / close) * 100 : 0;
      const dayAbs   = (ltp - close) * qty;
      const total    = avgCost > 0 ? ((ltp - avgCost) / avgCost) * 100 : 0;

      // Strip the exchange suffix Angel One appends (e.g. "SBIN-EQ" → "SBIN")
      const ticker = (h.tradingsymbol as string).replace(/-EQ$|-BE$|-BL$|-BT$/, '');

      return {
        id: `angel-${ticker}-${i}`,
        name: ticker,
        ticker,
        units: qty,
        avgCost,
        ltp,
        value,
        daily,
        dayAbs,
        total,
        weight: 0,
        sector: sectorFromSymbol(ticker) ?? 'Other',
        source: 'angel_one' as const,
      };
    });

    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    holdings.forEach((h) => {
      h.weight = totalValue > 0 ? (h.value / totalValue) * 100 : 0;
    });

    return NextResponse.json({ holdings, totalValue }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err) {
    console.error('[Angel Holdings]', err);
    // If the token is expired, tell the frontend to reconnect
    if (err instanceof Error && err.message.includes('401')) {
      return NextResponse.json({ error: 'reconnect_required' }, { status: 401 });
    }
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

const SECTOR_MAP: Record<string, string> = {
  HDFCBANK: 'Banking', ICICIBANK: 'Banking', KOTAKBANK: 'Banking', SBIN: 'Banking',
  AXISBANK: 'Banking', INDUSINDBK: 'Banking', BANDHANBNK: 'Banking', FEDERALBNK: 'Banking',
  BAJFINANCE: 'Finance', BAJAJFINSV: 'Finance', CHOLAFIN: 'Finance', MUTHOOTFIN: 'Finance',
  HDFC: 'Finance', LICHSGFIN: 'Finance', PNBHOUSING: 'Finance',
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT', MPHASIS: 'IT',
  LTIM: 'IT', COFORGE: 'IT', PERSISTENT: 'IT', OFSS: 'IT',
  RELIANCE: 'Oil & Gas', ONGC: 'Oil & Gas', BPCL: 'Oil & Gas', IOC: 'Oil & Gas',
  HINDPETRO: 'Oil & Gas', GAIL: 'Oil & Gas', PETRONET: 'Oil & Gas',
  HINDUNILVR: 'FMCG', ITC: 'FMCG', NESTLEIND: 'FMCG', BRITANNIA: 'FMCG',
  DABUR: 'FMCG', MARICO: 'FMCG', COLPAL: 'FMCG', GODREJCP: 'FMCG',
  MARUTI: 'Auto', TATAMOTORS: 'Auto', BAJAJ_AUTO: 'Auto', EICHERMOT: 'Auto',
  HEROMOTOCO: 'Auto', TVSMOTOR: 'Auto', ASHOKLEY: 'Auto', M_M: 'Auto',
  SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma', DIVISLAB: 'Pharma',
  AUROPHARMA: 'Pharma', LUPIN: 'Pharma', TORNTPHARM: 'Pharma', ALKEM: 'Pharma',
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals', VEDL: 'Metals',
  SAIL: 'Metals', NMDC: 'Metals', COALINDIA: 'Metals',
  DLF: 'Real Estate', GODREJPROP: 'Real Estate', OBEROIRLTY: 'Real Estate', LODHA: 'Real Estate',
  ANANTRAJ: 'Real Estate', PRESTIGE: 'Real Estate',
  LT: 'Capital Goods', ABB: 'Capital Goods', BHEL: 'Capital Goods', SIEMENS: 'Capital Goods',
  POLYCAB: 'Capital Goods', HAVELLS: 'Capital Goods', SUPREMEIND: 'Capital Goods',
  TITAN: 'Consumer', ASIANPAINT: 'Consumer', PIDILITIND: 'Consumer', WHIRLPOOL: 'Consumer',
  VOLTAS: 'Consumer', DMART: 'Consumer', TRENT: 'Consumer', NYKAA: 'Consumer',
  BHARTIARTL: 'Telecom', RJIO: 'Telecom', IDEA: 'Telecom',
  NTPC: 'Power', POWERGRID: 'Power', TATAPOWER: 'Power', ADANIPOWER: 'Power', CESC: 'Power',
  ULTRACEMCO: 'Cement', SHREECEM: 'Cement', AMBUJACEM: 'Cement', ACC: 'Cement',
  ZOMATO: 'Internet', PAYTM: 'Internet', POLICYBZR: 'Internet', IRCTC: 'Internet',
};

function sectorFromSymbol(symbol: string): string | null {
  return SECTOR_MAP[symbol.toUpperCase()] ?? null;
}
