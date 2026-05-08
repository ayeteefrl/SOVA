import type { Holding } from './data';

export type PortfolioMetrics = {
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  rollingReturns: { period: string; returnPct: number }[];
  volatility: number;
  beta: number;
};

// Annualized risk-free rate (Indian 10Y Govt Bond ~7%)
const RISK_FREE_RATE = 0.07;

// Compute Sharpe Ratio from daily return series
// Sharpe = (annualized return - risk-free rate) / annualized volatility
export function computeSharpeRatio(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = dailyReturns.reduce((a, r) => a + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 0;
  const annualizedReturn = mean * 252;
  const annualizedVol = stdDev * Math.sqrt(252);
  return (annualizedReturn - RISK_FREE_RATE) / annualizedVol;
}

// Compute Sortino Ratio (uses only downside deviation)
export function computeSortinoRatio(dailyReturns: number[]): number {
  if (dailyReturns.length < 5) return 0;
  const mean = dailyReturns.reduce((a, r) => a + r, 0) / dailyReturns.length;
  const downside = dailyReturns.filter((r) => r < 0);
  if (downside.length === 0) return mean > 0 ? 3 : 0;
  const downsideVariance = downside.reduce((a, r) => a + r ** 2, 0) / downside.length;
  const downsideDev = Math.sqrt(downsideVariance);
  if (downsideDev === 0) return 0;
  const annualizedReturn = mean * 252;
  const annualizedDownside = downsideDev * Math.sqrt(252);
  return (annualizedReturn - RISK_FREE_RATE) / annualizedDownside;
}

// Compute max drawdown from a value time series
export function computeMaxDrawdown(values: number[]): { maxDrawdown: number; maxDrawdownPct: number } {
  if (values.length < 2) return { maxDrawdown: 0, maxDrawdownPct: 0 };
  let peak = values[0];
  let maxDd = 0;
  let maxDdPct = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak - v;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
    }
  }
  return { maxDrawdown: maxDd, maxDrawdownPct: maxDdPct };
}

// Compute portfolio annualized volatility from daily % changes
export function computeVolatility(dailyReturns: number[]): number {
  if (dailyReturns.length < 2) return 0;
  const mean = dailyReturns.reduce((a, r) => a + r, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / (dailyReturns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// Compute rolling returns from snapshot values
export function computeRollingReturns(
  snapshots: { date: string; value: number }[],
): { period: string; returnPct: number }[] {
  if (snapshots.length < 2) return [];
  const latest = snapshots[snapshots.length - 1];
  const results: { period: string; returnPct: number }[] = [];

  const latestDate = new Date(latest.date);

  const periods = [
    { label: '1W', days: 7 },
    { label: '1M', days: 30 },
    { label: '3M', days: 90 },
    { label: '6M', days: 180 },
    { label: '1Y', days: 365 },
  ];

  for (const p of periods) {
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - p.days);
    const targetStr = targetDate.toISOString().slice(0, 10);

    // Find closest snapshot to target date
    let closest = snapshots[0];
    let minDiff = Infinity;
    for (const s of snapshots) {
      const diff = Math.abs(new Date(s.date).getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closest = s;
      }
    }

    // Only include if we have data close enough (within 10 days of target)
    if (minDiff < 10 * 86400000 && closest.value > 0) {
      const returnPct = ((latest.value - closest.value) / closest.value) * 100;
      results.push({ period: p.label, returnPct });
    }
  }

  return results;
}

// Compute weighted portfolio beta from individual holding betas
export function computePortfolioBeta(holdings: Holding[]): number {
  const total = holdings.reduce((a, h) => a + h.value, 0);
  if (total === 0) return 1;
  return holdings.reduce((a, h) => a + (h.beta ?? 1) * (h.value / total), 0);
}

// Estimate daily returns from snapshot series
export function snapshotsToDailyReturns(snapshots: { value: number }[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    if (snapshots[i - 1].value > 0) {
      returns.push((snapshots[i].value - snapshots[i - 1].value) / snapshots[i - 1].value);
    }
  }
  return returns;
}

// All-in-one: compute full portfolio metrics from snapshot history
export function computePortfolioMetrics(
  snapshots: { date: string; value: number }[],
  holdings: Holding[],
): PortfolioMetrics {
  const dailyReturns = snapshotsToDailyReturns(snapshots);
  const values = snapshots.map((s) => s.value);
  const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(values);

  return {
    sharpeRatio: computeSharpeRatio(dailyReturns),
    sortinoRatio: computeSortinoRatio(dailyReturns),
    maxDrawdown,
    maxDrawdownPct,
    rollingReturns: computeRollingReturns(snapshots),
    volatility: computeVolatility(dailyReturns),
    beta: computePortfolioBeta(holdings),
  };
}
