import { NextResponse, NextRequest } from 'next/server';
import { getKiteClient, shouldRefresh, triggerSilentRefresh } from '@/lib/kite-client';
import { getSession } from '@/lib/session';
import type { Holding } from '@/lib/data';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const kc = await getKiteClient(session.userId);
  if (!kc) {
    return NextResponse.json({ error: 'reconnect_required' }, { status: 401 });
  }

  if (await shouldRefresh(session.userId)) {
    triggerSilentRefresh();
  }

  try {
    const raw = await kc.getHoldings();

    const holdings: Holding[] = raw.map((h: any, i: number) => {
      const value = h.last_price * h.quantity;
      const total = h.average_price > 0
        ? ((h.last_price - h.average_price) / h.average_price) * 100
        : 0;
      // Zerodha provides sector in some API versions; fall back to a symbol-based lookup
      const sector = h.sector ?? sectorFromSymbol(h.tradingsymbol) ?? 'Other';
      return {
        id: `${h.tradingsymbol}-${i}`,
        name: h.exchange_token ? `${h.tradingsymbol}` : h.tradingsymbol,
        ticker: h.tradingsymbol,
        units: h.quantity,
        avgCost: h.average_price,
        ltp: h.last_price,
        value,
        daily: h.day_change_percentage ?? 0,
        total,
        weight: 0,
        sector,
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
    console.error('[Kite Holdings]', err);
    return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
  }
}

// Best-effort sector mapping for common NSE symbols
const SECTOR_MAP: Record<string, string> = {
  // Banking & Finance
  HDFCBANK: 'Banking', ICICIBANK: 'Banking', KOTAKBANK: 'Banking', SBIN: 'Banking',
  AXISBANK: 'Banking', INDUSINDBK: 'Banking', BANDHANBNK: 'Banking', FEDERALBNK: 'Banking',
  BAJFINANCE: 'Finance', BAJAJFINSV: 'Finance', CHOLAFIN: 'Finance', MUTHOOTFIN: 'Finance',
  HDFC: 'Finance', LICHSGFIN: 'Finance', PNBHOUSING: 'Finance',
  // IT
  TCS: 'IT', INFY: 'IT', WIPRO: 'IT', HCLTECH: 'IT', TECHM: 'IT', MPHASIS: 'IT',
  LTIM: 'IT', COFORGE: 'IT', PERSISTENT: 'IT', OFSS: 'IT',
  // Oil & Gas
  RELIANCE: 'Oil & Gas', ONGC: 'Oil & Gas', BPCL: 'Oil & Gas', IOC: 'Oil & Gas',
  HINDPETRO: 'Oil & Gas', GAIL: 'Oil & Gas', PETRONET: 'Oil & Gas',
  // FMCG
  HINDUNILVR: 'FMCG', ITC: 'FMCG', NESTLEIND: 'FMCG', BRITANNIA: 'FMCG',
  DABUR: 'FMCG', MARICO: 'FMCG', COLPAL: 'FMCG', GODREJCP: 'FMCG',
  // Auto
  MARUTI: 'Auto', TATAMOTORS: 'Auto', BAJAJ_AUTO: 'Auto', EICHERMOT: 'Auto',
  HEROMOTOCO: 'Auto', TVSMOTOR: 'Auto', ASHOKLEY: 'Auto', M_M: 'Auto',
  // Pharma
  SUNPHARMA: 'Pharma', DRREDDY: 'Pharma', CIPLA: 'Pharma', DIVISLAB: 'Pharma',
  AUROPHARMA: 'Pharma', LUPIN: 'Pharma', TORNTPHARM: 'Pharma', ALKEM: 'Pharma',
  // Metals
  TATASTEEL: 'Metals', JSWSTEEL: 'Metals', HINDALCO: 'Metals', VEDL: 'Metals',
  SAIL: 'Metals', NMDC: 'Metals', COALINDIA: 'Metals',
  // Real Estate
  DLF: 'Real Estate', GODREJPROP: 'Real Estate', OBEROIRLTY: 'Real Estate', LODHA: 'Real Estate',
  ANANTRAJ: 'Real Estate', PRESTIGE: 'Real Estate',
  // Infra & Capital Goods
  LT: 'Capital Goods', ABB: 'Capital Goods', BHEL: 'Capital Goods', SIEMENS: 'Capital Goods',
  POLYCAB: 'Capital Goods', HAVELLS: 'Capital Goods', SUPREMEIND: 'Capital Goods',
  // Consumer Discretionary
  TITAN: 'Consumer', ASIANPAINT: 'Consumer', PIDILITIND: 'Consumer', WHIRLPOOL: 'Consumer',
  VOLTAS: 'Consumer', DMART: 'Consumer', TRENT: 'Consumer', NYKAA: 'Consumer',
  // Telecom
  BHARTIARTL: 'Telecom', RJIO: 'Telecom', IDEA: 'Telecom',
  // Power
  NTPC: 'Power', POWERGRID: 'Power', TATAPOWER: 'Power', ADANIPOWER: 'Power', CESC: 'Power',
  // Cement
  ULTRACEMCO: 'Cement', SHREECEM: 'Cement', AMBUJACEM: 'Cement', ACC: 'Cement',
  // Internet & New Economy
  ZOMATO: 'Internet', PAYTM: 'Internet', POLICYBZR: 'Internet', IRCTC: 'Internet',
};

function sectorFromSymbol(symbol: string): string | null {
  const s = symbol.replace(/-/g, '_').toUpperCase();
  return SECTOR_MAP[s] ?? null;
}
