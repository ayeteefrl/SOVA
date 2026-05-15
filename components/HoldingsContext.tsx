'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Holding, ActivityItem } from '@/lib/data';
import { checkPortfolioAlerts, checkHoldingAlerts } from '@/lib/alerts';

interface HoldingsContextType {
  equityHoldings: Holding[];
  mutualFundHoldings: Holding[];
  etfHoldings: Holding[];
  isLoading: boolean;
  isRefreshing: boolean;
  intradayReady: boolean;
  needsKiteReconnect: boolean;
  needsAngelReconnect: boolean;
  needsUpstoxReconnect: boolean;
  needsGrowwReconnect: boolean;
  needsHdfcReconnect: boolean;
  needsMotilaReconnect: boolean;
  refresh: () => void;
  addHolding: (holding: Holding, category: 'equity' | 'mf' | 'etf') => void;
  updateHolding: (id: string, updates: Partial<Holding>, category: 'equity' | 'mf' | 'etf') => void;
  removeHolding: (id: string, category: 'equity' | 'mf' | 'etf') => void;
  updateHoldingsFromActivity: (activity: ActivityItem) => void;
}

const HoldingsContext = createContext<HoldingsContextType | undefined>(undefined);

// Fetch live LTP for a custom holding using the stock API (tries NSE suffix)
async function fetchLivePrice(ticker: string): Promise<{ ltp: number; daily: number; change: number } | null> {
  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`;
  try {
    const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.stock?.price != null) {
      return {
        ltp: data.stock.price,
        daily: data.stock.changePercent ?? 0,
        change: data.stock.change ?? 0, // absolute per-share change
      };
    }
  } catch {}
  return null;
}

export function HoldingsProvider({ children }: { children: React.ReactNode }) {
  const [equityHoldings, setEquityHoldings] = useState<Holding[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('sova-equity-holdings'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [mutualFundHoldings, setMutualFundHoldings] = useState<Holding[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('sova-mf-holdings'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [etfHoldings, setETFHoldings] = useState<Holding[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('sova-etf-holdings'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  // Only show full loading skeleton when we have nothing cached to show
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const e = localStorage.getItem('sova-equity-holdings');
      const m = localStorage.getItem('sova-mf-holdings');
      const eLen = e ? (JSON.parse(e) as unknown[]).length : 0;
      const mLen = m ? (JSON.parse(m) as unknown[]).length : 0;
      return eLen === 0 && mLen === 0;
    } catch { return true; }
  });
  const [needsKiteReconnect, setNeedsKiteReconnect] = useState(false);
  const [needsAngelReconnect, setNeedsAngelReconnect] = useState(false);
  const [needsUpstoxReconnect, setNeedsUpstoxReconnect] = useState(false);
  const [needsGrowwReconnect, setNeedsGrowwReconnect] = useState(false);
  const [needsHdfcReconnect, setNeedsHdfcReconnect] = useState(false);
  const [needsMotilaReconnect, setNeedsMotilaReconnect] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // True once the first live API response with real dayAbs values has been received
  const [intradayReady, setIntradayReady] = useState(false);

  const fetchHoldings = useCallback(async () => {
    // Only show the full loading skeleton when we have nothing cached
    const hasCached = (() => {
      try {
        const e = localStorage.getItem('sova-equity-holdings');
        const m = localStorage.getItem('sova-mf-holdings');
        return !!(e && (JSON.parse(e) as unknown[]).length) || !!(m && (JSON.parse(m) as unknown[]).length);
      } catch { return false; }
    })();
    if (!hasCached) setIsLoading(true);
    setIsRefreshing(true);

    try {
      // Fetch each broker independently — a failure in one must not affect the others.
      // Custom holdings and MF are always fetched regardless of broker status.
      const {
        zerodhaEquity, zerodhaConnected, mfHoldings, customHoldings,
        angelEquity, angelConnected,
        upstoxEquity, upstoxConnected,
        growwEquity, growwConnected,
        hdfcEquity, hdfcConnected,
        motilaEquity, motilaConnected,
      } = await fetchAllSources();

      setNeedsKiteReconnect(!zerodhaConnected);
      setNeedsAngelReconnect(!angelConnected);
      setNeedsUpstoxReconnect(!upstoxConnected);
      setNeedsGrowwReconnect(!growwConnected);
      setNeedsHdfcReconnect(!hdfcConnected);
      setNeedsMotilaReconnect(!motilaConnected);

      const anyBrokerConnected = zerodhaConnected || angelConnected || upstoxConnected || growwConnected || hdfcConnected || motilaConnected;

      // If no brokers are connected, fall back to cached data + custom
      if (!anyBrokerConnected) {
        const enriched = await enrichWithLivePrices(customHoldings);
        loadFromCache(enriched);
        return;
      }

      // Build a deduplicated set — priority: Zerodha > Angel > Upstox > Groww > HDFC > Motilal > custom
      const seenTickers = new Set<string>();
      const brokerFeeds = [zerodhaEquity, angelEquity, upstoxEquity, growwEquity, hdfcEquity, motilaEquity];
      const deduped: Holding[] = [];
      for (const feed of brokerFeeds) {
        for (const h of feed) {
          const key = normalizeTicker(h.ticker ?? '');
          if (!key || seenTickers.has(key)) continue;
          seenTickers.add(key);
          deduped.push(h);
        }
      }

      // Only enrich custom holdings not already present in any broker feed
      const extraCustom = customHoldings.filter(
        (h) => !seenTickers.has(normalizeTicker(h.ticker ?? ''))
      );
      const enrichedCustom = await enrichWithLivePrices(extraCustom);

      const equity: Holding[] = [...deduped, ...enrichedCustom];
      setEquityHoldings(equity);
      setIntradayReady(true); // batched with setEquityHoldings — single render with correct dayAbs
      try { localStorage.setItem('sova-equity-holdings', JSON.stringify(stripIntraday(equity))); } catch {}

      // MF from Zerodha (Angel One SmartAPI does not provide MF holdings)
      if (mfHoldings.length > 0) {
        const etfs = mfHoldings.filter((h) => h.sector === 'ETF' || isEtfSymbol(h.ticker ?? ''));
        const funds = mfHoldings.filter((h) => h.sector !== 'ETF' && !isEtfSymbol(h.ticker ?? ''));
        setMutualFundHoldings(funds);
        setETFHoldings(etfs);
        try {
          localStorage.setItem('sova-mf-holdings', JSON.stringify(stripIntraday(funds)));
          localStorage.setItem('sova-etf-holdings', JSON.stringify(stripIntraday(etfs)));
        } catch {}
      }
    } catch {
      loadFromCache([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  function loadFromCache(customHoldings: Holding[] = []) {
    try {
      const e = localStorage.getItem('sova-equity-holdings');
      const m = localStorage.getItem('sova-mf-holdings');
      const f = localStorage.getItem('sova-etf-holdings');
      const cached: Holding[] = e ? JSON.parse(e) : [];
      const cachedTickerSet = new Set(cached.map((h) => normalizeTicker(h.ticker ?? '')));
      const extra = customHoldings.filter((h) => !cachedTickerSet.has(normalizeTicker(h.ticker ?? '')));
      setEquityHoldings([...cached, ...extra]);
      if (m) setMutualFundHoldings(JSON.parse(m));
      if (f) setETFHoldings(JSON.parse(f));
    } catch {}
  }

  useEffect(() => {
    fetchHoldings();
  }, [fetchHoldings]);

  // Refresh live prices every 30 seconds — only for custom holdings (Zerodha data is authoritative)
  useEffect(() => {
    const id = setInterval(async () => {
      setEquityHoldings((prev) => {
        if (prev.length === 0) return prev;
        const custom = prev.filter((h) => h.source !== 'zerodha' && h.source !== 'angel_one');
        const broker = prev.filter((h) => h.source === 'zerodha' || h.source === 'angel_one');
        if (custom.length === 0) return prev;
        enrichWithLivePrices(custom).then((enrichedCustom) => {
          const merged = [...broker, ...enrichedCustom];
          setEquityHoldings(merged);
          try { localStorage.setItem('sova-equity-holdings', JSON.stringify(stripIntraday(merged))); } catch {}
        });
        return prev;
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Sync today's Zerodha trades once per day
  useEffect(() => {
    if (isLoading || needsKiteReconnect) return;
    const lastSync = localStorage.getItem('sova-last-trade-sync');
    const today = new Date().toISOString().slice(0, 10);
    if (lastSync === today) return;

    fetch('/api/kite/sync-trades', { method: 'POST' })
      .then((r) => {
        if (r.ok) {
          localStorage.setItem('sova-last-trade-sync', today);
          window.dispatchEvent(new Event('sova:refresh'));
        }
      })
      .catch(() => {});
  }, [isLoading, needsKiteReconnect]);

  // Check portfolio alerts after fresh data loads
  const prevNetWorthRef = useRef<number>(0);
  useEffect(() => {
    if (isLoading) return;
    const all = [...equityHoldings, ...mutualFundHoldings, ...etfHoldings];
    if (all.length === 0) return;

    const currentNW = all.reduce((a, h) => a + h.value, 0);
    const prevNW = prevNetWorthRef.current;

    // Use invested amount as baseline for first comparison of the day
    if (prevNW === 0) {
      const invested = all.reduce((a, h) => a + h.units * h.avgCost, 0);
      prevNetWorthRef.current = invested > 0 ? invested : currentNW;
    }

    if (prevNetWorthRef.current > 0) {
      const portfolioFired = checkPortfolioAlerts(all, prevNetWorthRef.current);
      const holdingFired = checkHoldingAlerts(all);
      if (portfolioFired || holdingFired) {
        window.dispatchEvent(new Event('sova:notifications-updated'));
      }
    }

    prevNetWorthRef.current = currentNW;
  }, [isLoading, equityHoldings, mutualFundHoldings, etfHoldings]);

  // Save a daily portfolio snapshot once holdings have loaded
  useEffect(() => {
    if (isLoading) return;
    const lastSnap = localStorage.getItem('sova-last-snapshot');
    const today = new Date().toISOString().slice(0, 10);
    if (lastSnap === today) return; // already saved today

    const netWorth =
      equityHoldings.reduce((a, h) => a + h.value, 0) +
      mutualFundHoldings.reduce((a, h) => a + h.value, 0) +
      etfHoldings.reduce((a, h) => a + h.value, 0);

    if (netWorth === 0) return; // nothing to snapshot yet

    const totalInvested =
      equityHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
      mutualFundHoldings.reduce((a, h) => a + h.units * h.avgCost, 0) +
      etfHoldings.reduce((a, h) => a + h.units * h.avgCost, 0);

    fetch('/api/portfolio/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        net_worth: netWorth,
        total_invested: totalInvested,
        equity_value: equityHoldings.reduce((a, h) => a + h.value, 0),
        mf_value: mutualFundHoldings.reduce((a, h) => a + h.value, 0),
        etf_value: etfHoldings.reduce((a, h) => a + h.value, 0),
      }),
    })
      .then((r) => { if (r.ok) localStorage.setItem('sova-last-snapshot', today); })
      .catch(() => {});
  }, [isLoading, equityHoldings, mutualFundHoldings, etfHoldings]);

  const addHolding = useCallback((holding: Holding, category: 'equity' | 'mf' | 'etf') => {
    const h = { ...holding, id: holding.id || `${holding.ticker}-${Date.now()}` };
    if (category === 'equity') setEquityHoldings((prev) => [...prev, h]);
    else if (category === 'mf') setMutualFundHoldings((prev) => [...prev, h]);
    else setETFHoldings((prev) => [...prev, h]);
  }, []);

  const updateHolding = useCallback((id: string, updates: Partial<Holding>, category: 'equity' | 'mf' | 'etf') => {
    const patch = (prev: Holding[]) => prev.map((h) => (h.id === id ? { ...h, ...updates } : h));
    if (category === 'equity') setEquityHoldings(patch);
    else if (category === 'mf') setMutualFundHoldings(patch);
    else setETFHoldings(patch);
  }, []);

  const removeHolding = useCallback((id: string, category: 'equity' | 'mf' | 'etf') => {
    const filter = (prev: Holding[]) => prev.filter((h) => h.id !== id);
    if (category === 'equity') setEquityHoldings(filter);
    else if (category === 'mf') setMutualFundHoldings(filter);
    else setETFHoldings(filter);
  }, []);

  const updateHoldingsFromActivity = useCallback((activity: ActivityItem) => {
    if (activity.category !== 'Trade') return;
    const ticker = activity.tradeTicker;
    if (!ticker) return;

    const isBuy = activity.tradeAction === 'Buy';
    const units = activity.tradeUnits ?? 0;
    const price = activity.tradePrice ?? 0;
    const instrumentType = activity.tradeInstrumentType ?? 'Equity';

    const normalizedTicker = normalizeTicker(ticker);
    const applyTrade = (holdings: Holding[]): Holding[] => {
      const idx = holdings.findIndex(
        (h) =>
          normalizeTicker(h.ticker ?? '') === normalizedTicker ||
          h.name?.toLowerCase() === (activity.instrumentName ?? '').toLowerCase(),
      );
      if (idx >= 0) {
        const h = holdings[idx];
        const newUnits = isBuy ? h.units + units : Math.max(0, h.units - units);
        const newAvgCost = isBuy && units > 0
          ? (h.units * h.avgCost + units * price) / (h.units + units)
          : h.avgCost;
        const updated = [...holdings];
        updated[idx] = { ...h, units: newUnits, avgCost: newAvgCost, ltp: price || h.ltp, value: newUnits * (price || h.ltp) };
        return updated;
      } else if (isBuy && units > 0) {
        return [...holdings, {
          id: `${ticker}-${Date.now()}`, name: activity.instrumentName ?? ticker, ticker,
          units, avgCost: price, ltp: price, value: units * price,
          daily: 0, total: 0, weight: 0, sector: activity.tradeSector ?? 'Other',
          source: 'custom' as const,
        }];
      }
      return holdings;
    };

    if (instrumentType === 'Equity') setEquityHoldings(applyTrade);
    else if (instrumentType === 'MF') setMutualFundHoldings(applyTrade);
    else setETFHoldings(applyTrade);
  }, []);

  return (
    <HoldingsContext.Provider value={{
      equityHoldings, mutualFundHoldings, etfHoldings,
      isLoading, isRefreshing, intradayReady,
      needsKiteReconnect, needsAngelReconnect,
      needsUpstoxReconnect, needsGrowwReconnect, needsHdfcReconnect, needsMotilaReconnect,
      refresh: fetchHoldings,
      addHolding, updateHolding, removeHolding, updateHoldingsFromActivity,
    }}>
      {children}
    </HoldingsContext.Provider>
  );
}

export function useHoldings() {
  const ctx = useContext(HoldingsContext);
  if (!ctx) throw new Error('useHoldings must be used within HoldingsProvider');
  return ctx;
}

// Fetch all data sources in parallel with full isolation.
// A network or auth failure in any one broker leaves the others unaffected.
async function fetchAllSources(): Promise<{
  zerodhaEquity: Holding[]; zerodhaConnected: boolean;
  mfHoldings: Holding[]; customHoldings: Holding[];
  angelEquity: Holding[]; angelConnected: boolean;
  upstoxEquity: Holding[]; upstoxConnected: boolean;
  growwEquity: Holding[]; growwConnected: boolean;
  hdfcEquity: Holding[]; hdfcConnected: boolean;
  motilaEquity: Holding[]; motilaConnected: boolean;
}> {
  const fetchZerodha = async () => {
    try {
      let [equityRes, mfRes] = await Promise.all([
        fetch('/api/kite/holdings'),
        fetch('/api/kite/mf'),
      ]);
      if (equityRes.status === 401) {
        const r = await fetch('/api/auth/kite/refresh', { method: 'POST' });
        if (r.ok) {
          [equityRes, mfRes] = await Promise.all([
            fetch('/api/kite/holdings'),
            fetch('/api/kite/mf'),
          ]);
        }
      }
      if (equityRes.status === 401) return { equity: [], connected: false, mf: [] };
      const equity = equityRes.ok ? ((await equityRes.json()).holdings ?? []) : [];
      const mf     = mfRes.ok    ? ((await mfRes.json()).holdings    ?? []) : [];
      return { equity, connected: true, mf };
    } catch {
      return { equity: [], connected: false, mf: [] };
    }
  };

  const fetchAngel = async () => {
    try {
      let res = await fetch('/api/angel/holdings');
      if (res.status === 401) {
        const r = await fetch('/api/auth/angel/refresh', { method: 'POST' });
        if (r.ok) res = await fetch('/api/angel/holdings');
      }
      if (res.status === 401) return { equity: [], connected: false };
      const equity = res.ok ? ((await res.json()).holdings ?? []) : [];
      return { equity, connected: true };
    } catch {
      return { equity: [], connected: false };
    }
  };

  const fetchCustom = async (): Promise<Holding[]> => {
    try {
      const res = await fetch('/api/holdings/custom');
      return res.ok ? ((await res.json()).holdings ?? []) : [];
    } catch {
      return [];
    }
  };

  const fetchCamsMF = async (): Promise<Holding[]> => {
    try {
      const res = await fetch('/api/holdings/mf');
      return res.ok ? ((await res.json()).holdings ?? []) : [];
    } catch {
      return [];
    }
  };

  const fetchBroker = async (path: string, source: string) => {
    try {
      const res = await fetch(path);
      const data = await res.json();
      if (data.error?.includes('unauthorized')) return { equity: [], connected: false };
      return { equity: (data.holdings ?? []) as Holding[], connected: (data.holdings?.length ?? 0) >= 0 && !data.error };
    } catch {
      return { equity: [], connected: false };
    }
  };

  const [z, a, customHoldings, camsMF, upstox, groww, hdfc, motila] = await Promise.all([
    fetchZerodha(),
    fetchAngel(),
    fetchCustom(),
    fetchCamsMF(),
    fetchBroker('/api/upstox/holdings', 'upstox'),
    fetchBroker('/api/groww/holdings', 'groww'),
    fetchBroker('/api/hdfc/holdings', 'hdfc'),
    fetchBroker('/api/motilal/holdings', 'motilal'),
  ]);

  return {
    zerodhaEquity: z.equity,
    zerodhaConnected: z.connected,
    // Merge Zerodha MF with CAMS-imported MF (deduplicate by ticker/ISIN)
    mfHoldings: (() => {
      const seen = new Set(z.mf.map((h) => h.ticker ?? h.id));
      return [...z.mf, ...camsMF.filter((h) => !seen.has(h.ticker ?? h.id))];
    })(),
    customHoldings,
    angelEquity: a.equity,
    angelConnected: a.connected,
    upstoxEquity: upstox.equity,
    upstoxConnected: upstox.connected,
    growwEquity: groww.equity,
    growwConnected: groww.connected,
    hdfcEquity: hdfc.equity,
    hdfcConnected: hdfc.connected,
    motilaEquity: motila.equity,
    motilaConnected: motila.connected,
  };
}

// Enrich custom holdings with live LTP from Yahoo Finance
async function enrichWithLivePrices(holdings: Holding[]): Promise<Holding[]> {
  if (holdings.length === 0) return holdings;
  const enriched = await Promise.allSettled(
    holdings.map(async (h) => {
      if (!h.ticker) return h;
      const live = await fetchLivePrice(h.ticker);
      if (!live) return h;
      return {
        ...h,
        ltp: live.ltp,
        value: h.units * live.ltp,
        daily: live.daily,
        dayAbs: live.change * h.units, // absolute INR day change
        total: h.avgCost > 0 ? ((live.ltp - h.avgCost) / h.avgCost) * 100 : 0,
      };
    })
  );
  return enriched.map((r, i) => (r.status === 'fulfilled' ? r.value : holdings[i]));
}

function isEtfSymbol(symbol: string): boolean {
  const etfSuffixes = ['BEES', 'ETF', 'GOLDBEES', 'NIFTYBEES', 'BANKBEES', 'MON100'];
  const upper = symbol.toUpperCase();
  return etfSuffixes.some((s) => upper.includes(s));
}

function normalizeTicker(t: string): string {
  return t.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, '');
}

// Remove intraday fields before persisting to localStorage.
// Intraday % from one session is meaningless the next day and shows wrong values.
function stripIntraday(holdings: Holding[]): Holding[] {
  return holdings.map(({ daily: _d, dayAbs: _da, ...rest }) => ({ ...rest, daily: 0 }));
}
