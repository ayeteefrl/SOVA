// ─── Type definitions ────────────────────────────────────────────────────────
// All runtime values come from Kite Connect API routes (/api/kite/*)
// These types are shared across the app.

export type TickerEntry = {
  symbol: string;
  price: number;
  change: number; // percent
};

export type Holding = {
  id: string;
  name: string;
  ticker?: string;
  units: number;
  avgCost: number;
  ltp: number;
  value: number;
  daily: number; // pct change from prev close
  dayAbs?: number; // absolute INR day change = (ltp - prevClose) * qty
  total: number; // pct
  weight: number; // pct
  sector?: string;
  source?: 'zerodha' | 'custom';
  sparkline?: number[];
  beta?: number;
  volatility30d?: number;
  riskLevel?: 'Low' | 'Medium' | 'High';
};

export type Trade = {
  id: string;
  name: string;
  kind: 'Buy Order' | 'Sell Order' | 'SIP Execution' | 'Dividend' | 'Interest';
  asset: 'Equity' | 'Mutual Fund' | 'ETF' | 'Real Estate' | 'Cash';
  amount: string;
  delta: 'up' | 'down' | 'flat';
  time: string;
};

export type Property = {
  id: string;
  name: string;
  location: string;
  type: 'Residential' | 'Commercial' | 'Land';
  purchase: number;
  current: number;
  yield: number; // rental yield %
  appreciation: number; // pct total
};

export type WatchItem = {
  id: string;
  name: string;
  ticker: string;
  price: number;
  change: number;
  sparkline: number[];
  marketCap: string;
  pe: number;
  notes?: string;
};

export type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  category: 'Trade' | 'SIP' | 'Dividend' | 'Deposit' | 'Withdrawal' | 'Rebalance';
  amount: number;
  positive: boolean;
  timestamp: string;
  rationale?: string;
  tradeAction?: 'Buy' | 'Sell';
  tradeTicker?: string;
  instrumentName?: string;
  tradeUnits?: number;
  tradePrice?: number;
  tradeInstrumentType?: 'Equity' | 'MF' | 'ETF';
  tradeSector?: string;
};

export type NewsItem = {
  id: string;
  headline: string;
  source: string;
  category: 'Markets' | 'Macro' | 'Earnings' | 'Policy' | 'Global' | 'Sector';
  summary: string;
  tickers?: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  time: string;
};

export type SectorExposure = {
  sector: string;
  weight: number; // pct
};

// ─── Static fallbacks (shown before Kite data loads) ─────────────────────────

export const marketTicker: TickerEntry[] = [];

export const summary = {
  netWorth: 0,
  dayChange: 0,
  dayChangePct: 0,
  allTimeGain: 0,
  cagr: 0,
  freeCashFlow: 0,
};

export const performanceSeries: { label: string; value: number; benchmark: number; isFYEnd: boolean }[] = [];

export const allocation: { name: string; value: number; color: string }[] = [
  { name: 'Equity', value: 0, color: '#adc6ff' },
  { name: 'Mutual Funds', value: 0, color: '#4edea3' },
  { name: 'ETF', value: 0, color: '#8b9dff' },
  { name: 'Real Estate', value: 0, color: '#ffb2b7' },
  { name: 'Cash / Liquidity', value: 0, color: '#D4AF37' },
];

export const recentTrades: Trade[] = [];

export const equityHoldings: Holding[] = [];
export const mutualFundHoldings: Holding[] = [];
export const etfHoldings: Holding[] = [];

export const realEstate: Property[] = [];

export const watchlist: WatchItem[] = [];

export const activityLog: ActivityItem[] = [];

export const newsFeed: NewsItem[] = [];

export const sectorExposure: SectorExposure[] = [];
