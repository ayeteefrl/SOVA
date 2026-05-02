import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Approximate exchange rates relative to INR (updated periodically)
export const FX_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0094,
  JPY: 1.77,
  SGD: 0.016,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥', SGD: 'S$',
};

export function formatINR(n: number, opts: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals = 0 } = opts;
  if (compact) {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  }
  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)}`;
}

export function formatCurrency(
  n: number,
  currency: string,
  opts: { compact?: boolean; decimals?: number } = {},
) {
  if (currency === 'INR') return formatINR(n, opts);
  const rate = FX_RATES[currency] ?? 1;
  const converted = n * rate;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const { compact = false, decimals = 2 } = opts;
  if (compact) {
    if (Math.abs(converted) >= 1_000_000_000) return `${symbol}${(converted / 1_000_000_000).toFixed(2)}B`;
    if (Math.abs(converted) >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(2)}M`;
    if (Math.abs(converted) >= 1_000) return `${symbol}${(converted / 1_000).toFixed(1)}K`;
  }
  return `${symbol}${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(converted)}`;
}

export function formatDelta(n: number, decimals = 2) {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function formatNumber(n: number, decimals = 0) {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n);
}
