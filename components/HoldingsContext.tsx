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
        const data = await equityRes.json().catch(() => ({}));
        setNeedsKiteReconnect(data.error === 'reconnect_required');
        // Even without Kite, load custom + cache
        let customHoldings: Holding[] = [];
        if (customRes.ok) {
          const cdata = await customRes.json();
          customHoldings = cdata.holdings ?? [];
        }
        loadFromCache(customHoldings);
        return;
      }

      setNeedsKiteReconnect(false);

      let zerodhaEquity: Holding[] = [];
      if (equityRes.ok) {
        const data = await equityRes.json();
        zerodhaEquity = data.holdings ?? [];
      }

      // Merge custom holdings for tickers not already tracked by Zerodha
      let customHoldings: Holding[] = [];
      if (customRes.ok) {
        const cdata = await customRes.json();
        customHoldings = cdata.holdings ?? [];
      }
      const zerodhaTickerSet = new Set(zerodhaEquity.map((h) => normalizeTicker(h.ticker ?? '')));
      const extraCustom = customHoldings.filter(
        (h) => !zerodhaTickerSet.has(normalizeTicker(h.ticker ?? ''))
      );
      const equity: Holding[] = [...zerodhaEquity, ...extraCustom];
      setEquityHoldings(equity);
      try { localStorage.setItem('sova-equity-holdings', JSON.stringify(equity)); } catch {}

      if (mfRes.ok) {
        const data = await mfRes.json();
        const mf: Holding[] = data.holdings ?? [];
        // Split ETFs (exchange-traded) from MFs (based on tradingsymbol suffix or instrument type)
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
      // Merge custom holdings that aren't in cache
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
          id: `${ticker}-${Date.now()}`, name: ticker, ticker,
          units, avgCost: price, ltp: price, value: units * price,
          daily: 0, total: 0, weight: 0, sector: 'Unknown',
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

function isEtfSymbol(symbol: string): boolean {
  const etfSuffixes = ['BEES', 'ETF', 'GOLDBEES', 'NIFTYBEES', 'BANKBEES', 'MON100'];
  const upper = symbol.toUpperCase();
  return etfSuffixes.some((s) => upper.includes(s));
}

function normalizeTicker(t: string): string {
  return t.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, '');
}
