// Shared types for CAS (Consolidated Account Statement) integration.
// Supports MFCentral (mutual funds via PAN+OTP) and Setu AA (all assets).

export type CASProvider = 'mfcentral' | 'setu_aa';

export interface CASHolding {
  isin: string;
  name: string;
  amc?: string;
  folio?: string;
  units: number;
  nav: number;
  value: number;
  costValue: number;
  assetType: 'MF' | 'Equity' | 'ETF';
  purchaseDate?: string;
}

export interface CASRequestResult {
  requestId: string;
  maskedMobile: string;
}

export interface CASVerifyResult {
  holdings: CASHolding[];
  pan: string;
  name?: string;
  email?: string;
}

export function casFormatINR(n: number): string {
  if (!n || isNaN(n)) return '₹0';
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function isPAN(s: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/i.test(s.trim());
}

export function isMobile(s: string): boolean {
  return /^[6-9]\d{9}$/.test(s.trim());
}
