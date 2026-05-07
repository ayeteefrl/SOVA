'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Holding, ActivityItem } from '@/lib/data';

interface HoldingsContextType {
  equityHoldings: Holding[];
  mutualFundHoldings: Holding[];
  etfHoldings: Holding[];
  isLoading: boolean;
  needsKiteReconnect: boolean;
  refresh: () => void;
  addHolding: (holding: Holding, category: 'equity' | 'mf' | 'etf') => void;
  updateHolding: (id: string, updates: Partial<Holding>, category: 'equity' | 'mf' | 'etf') => void;
  removeHolding: (id: string, category: 'equity' | 'mf' | 'etf') => void;
  updateHoldingsFromActivity: (activity: ActivityItem) => void;
}

const HoldingsContext = createContext<HoldingsContextType | undefined>(undefined);

// Fetch live LTP for a custom holding using the stock API (tries NSE suffix)
async function fetchLivePrice(ticker: string): Promise<{ ltp: number; daily: number } | null> {
  const symbol = ticker.includes('.') ? ticker : `${ticker}.NS`;
  try {
    const res = await fetch(`/api/stock?symbol=${encodeURIComponent(symbol)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.stock?.price != null) {
      return { ltp: data.stock.price, daily: data.stock.changePercent ?? 0 };
    }
  } catch {}
  return null;
}

export function HoldingsProvider({ children }: { children: React.ReactNode }) {
  const [equityHoldings, setEquityHoldings] = useState<Holding[]>([]);
  const [mutualFundHoldings, setMutualFundHoldings] = useState<Holding[]>([]);
  const [etfHoldings, setETFHoldings] = useState<Holding[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [needsKiteReconnect, setNeedsKiteReconnect] = useState(false);

  const fetchHoldings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [equityRes, mfRes, customRes] = await Promise.all([
        fetch('/api/kite/holdings'),
        fetch('/api/kite/mf'),
        fetch('/api/holdings/custom'),
      ]);

      if (equityRes.status === 401) {
        setNeedsKiteReconnect(true);
        let customHoldings: Holding[] = [];
        if (customRes.ok) {
          const cdata = await customRes.json();
          customHoldings = cdata.holdings ?? [];
        }
        // Enrich custom holdings with live prices even when Zerodha is disconnected
        const enriched = await enrichWithLivePrices(customHoldings);
        loadFromCache(enriched);
        return;
      }

      setNeedsKiteReconnect(false);

      let zerodhaEquity: Holding[] = [];
      if (equityRes.ok) {
        const data = await equityRes.json();
        zerodhaEquity = data.holdings ?? [];
      }

      let customHoldings: Holding[] = [];
      if (customRes.ok) {
        const cdata = await customRes.json();
        customHoldings = cdata.holdings ?? [];
      }

      // Merge: custom holdings not already tracked by Zerodha
      const zerodhaTickerSet = new Set(zerodhaEquity.map((h) => normalizeTicker(h.ticker ?? '')));
      const extraCustom = customHoldings.filter(
        (h) => !zerodhaTickerSet.has(normalizeTicker(h.ticker ?? ''))
      );

      // Fetch live prices for custom holdings (Zerodha already provides live LTP)
      const enrichedCustom = await enrichWithLivePrices(extraCustom);

      const equity: Holding[] = [...zerodhaEquity, ...enrichedCustom];
      setEquityHoldings(equity);
      try { localStorage.setItem('sova-equity-holdings', JSON.stringify(equity)); } catch {}

      if (mfRes.ok) {
        const data = await mfRes.json();
        const mf: Holding[] = data.holdings ?? [];
        const etfs = mf.filter((h) => h.sector === 'ETF' || isEtfSymbol(h.ticker ?? ''));
        const funds = mf.filter((h) => h.sector !== 'ETF' && !isEtfSymbol(h.ticker ?? ''));
        setMutualFundHoldings(funds);
        setETFHoldings(etfs);
        try {
          localStorage.setItem('sova-mf-holdings', JSON.stringify(funds));
          localStorage.setItem('sova-etf-holdings', JSON.stringify(etfs));
        } catch {}
      }
    } catch {
      loadFromCache([]);
    } finally {
      setIsLoading(false);
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

  // Refresh live prices every 30 seconds for custom holdings
  useEffect(() => {
    const id = setInterval(async () => {
      setEquityHoldings((prev) => {
        if (prev.length === 0) return prev;
        enrichWithLivePrices(prev).then((enriched) => {
          setEquityHoldings(enriched);
          try { localStorage.setItem('sova-equity-holdings', JSON.stringify(enriched)); } catch {}
        });
        return prev;
      });
    }, 30000);
    return () => clearInterval(id);
  }, []);

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
      isLoading, needsKiteReconnect,
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
