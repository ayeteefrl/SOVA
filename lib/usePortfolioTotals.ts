'use client';

/* ── Portfolio-wide totals ──────────────────────────────────────────────────
   Single source of truth for Net Worth / Total Invested / All-Time Gain,
   shared by Home, Dashboard, and the performance chart's daily snapshot.
   Each sleeve's number matches EXACTLY what its own dedicated page shows:
     - Equity     → HoldingsContext.equityHoldings   (same as the Equity sleeve)
     - Mutual Fund→ /api/sips                         (same as the MF sleeve's Book Value)
     - ETF        → /api/etfs                         (same as the ETF sleeve's Portfolio Total)
     - PPF        → /api/ppf/corpus                   (same as the PPF page's Current Corpus)
     - Real Estate→ /api/real-estate                  (same as the Property Value KPI)
   Deliberately does NOT use HoldingsContext.mutualFundHoldings/etfHoldings —
   those come from a broker/CAMS pipeline that the dedicated MF/ETF sleeve
   pages never read, so using them here would show a number nobody's sleeve
   page agrees with (and after the trade-logging fix, ticket-logged MF trades
   land in both user_trades and user_sips, so summing both would double count).
────────────────────────────────────────────────────────────────────────────── */

import { useEffect, useState, useCallback } from 'react';
import { useHoldings } from '@/components/HoldingsContext';
import { computeAutoInvested, computeCurrentValue, type SIP } from '@/lib/sips';

interface ETFRow { units: number; avg_cost: number; current_price?: number | null }
interface RealEstateRow { current_value: number; purchase_price: number }
interface PPFCorpus { corpus: number; totalDeposited: number }

export interface PortfolioTotals {
  equityValue: number; equityInvested: number;
  mfValue: number; mfInvested: number;
  etfValue: number; etfInvested: number;
  ppfValue: number; ppfInvested: number;
  realEstateValue: number; realEstateInvested: number;
  netWorth: number; totalInvested: number;
  allTimeGain: number; allTimeGainPct: number;
  dayChange: number; dayChangePct: number;
  isLoading: boolean;
}

const SNAPSHOT_KEY = 'sova-last-snapshot-v2';

export function usePortfolioTotals(): PortfolioTotals {
  const { equityHoldings, isLoading: holdingsLoading, intradayReady } = useHoldings();
  const [sips, setSips] = useState<SIP[]>([]);
  const [etfs, setEtfs] = useState<ETFRow[]>([]);
  const [ppf, setPpf] = useState<PPFCorpus>({ corpus: 0, totalDeposited: 0 });
  const [realEstate, setRealEstate] = useState<RealEstateRow[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);

  const loadExtras = useCallback(() => {
    setExtrasLoading(true);
    Promise.all([
      fetch('/api/sips').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/etfs').then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch('/api/ppf/corpus').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/real-estate').then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([sipsData, etfsData, ppfData, reData]) => {
      setSips(Array.isArray(sipsData) ? sipsData : []);
      setEtfs(Array.isArray(etfsData) ? etfsData : []);
      if (ppfData) setPpf({ corpus: ppfData.corpus ?? 0, totalDeposited: ppfData.totalDeposited ?? 0 });
      setRealEstate(Array.isArray(reData) ? reData : []);
    }).finally(() => setExtrasLoading(false));
  }, []);

  useEffect(() => {
    loadExtras();
    window.addEventListener('sova:refresh', loadExtras);
    return () => window.removeEventListener('sova:refresh', loadExtras);
  }, [loadExtras]);

  const equityValue    = equityHoldings.reduce((a, h) => a + h.value, 0);
  const equityInvested = equityHoldings.reduce((a, h) => a + h.units * h.avgCost, 0);

  const mfInvested = sips.reduce((a, s) => a + computeAutoInvested(s), 0);
  const mfValue    = sips.reduce((a, s) => a + computeCurrentValue(s), 0);

  const etfInvested = etfs.reduce((a, e) => a + Number(e.units) * Number(e.avg_cost), 0);
  const etfValue    = etfs.reduce((a, e) => a + Number(e.units) * Number(e.current_price ?? e.avg_cost), 0);

  const ppfValue    = ppf.corpus;
  const ppfInvested = ppf.totalDeposited;

  const realEstateValue    = realEstate.reduce((a, p) => a + Number(p.current_value ?? 0), 0);
  const realEstateInvested = realEstate.reduce((a, p) => a + Number(p.purchase_price ?? 0), 0);

  const netWorth      = equityValue + mfValue + etfValue + ppfValue + realEstateValue;
  const totalInvested = equityInvested + mfInvested + etfInvested + ppfInvested + realEstateInvested;
  const allTimeGain    = netWorth - totalInvested;
  const allTimeGainPct = totalInvested > 0 ? (allTimeGain / totalInvested) * 100 : 0;

  // Day change only reflects equity — MF/ETF/PPF/Real Estate here have no
  // live intraday price feed, so a "day change" for them would be fake precision.
  const dayChange    = equityHoldings.reduce((a, h) => a + (h.dayAbs ?? (h.value * h.daily) / 100), 0);
  const dayChangePct = netWorth > 0 ? (dayChange / netWorth) * 100 : 0;

  const isLoading = holdingsLoading || extrasLoading;

  // Save one daily snapshot reflecting the FULL net worth (all five sleeves).
  // Keyed by date AND net worth (rounded to the rupee) rather than just date —
  // otherwise the first value computed each day "freezes" as today's snapshot,
  // and logging a PPF or Real Estate trade later the same day would never
  // update the performance chart's current point until tomorrow.
  useEffect(() => {
    if (isLoading || netWorth === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const signature = `${today}:${Math.round(netWorth)}`;
    if (localStorage.getItem(SNAPSHOT_KEY) === signature) return;

    fetch('/api/portfolio/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        net_worth: netWorth,
        total_invested: totalInvested,
        equity_value: equityValue,
        mf_value: mfValue,
        etf_value: etfValue,
        ppf_value: ppfValue,
        real_estate_value: realEstateValue,
      }),
    }).then((r) => {
      if (r.ok) {
        localStorage.setItem(SNAPSHOT_KEY, signature);
        // Let the performance chart know today's point just changed —
        // otherwise it only re-fetches on a trade being logged, and would
        // keep showing a stale figure until the next unrelated refresh.
        window.dispatchEvent(new Event('sova:refresh'));
      }
    }).catch(() => {});
  }, [isLoading, netWorth, totalInvested, equityValue, mfValue, etfValue, ppfValue, realEstateValue]);

  return {
    equityValue, equityInvested,
    mfValue, mfInvested,
    etfValue, etfInvested,
    ppfValue, ppfInvested,
    realEstateValue, realEstateInvested,
    netWorth, totalInvested,
    allTimeGain, allTimeGainPct,
    dayChange, dayChangePct: intradayReady ? dayChangePct : 0,
    isLoading,
  };
}
