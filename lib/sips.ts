/* ── Shared Mutual Fund SIP types & math ───────────────────────────────────
   Single source of truth for how a SIP's invested amount is computed, so
   the Mutual Fund sleeve page and portfolio-wide totals (Home, Dashboard)
   never drift apart.
────────────────────────────────────────────────────────────────────────────── */

export type LumpSumEntry = {
  date: string; // YYYY-MM-DD
  amount: number;
  note?: string;
};

export type SIP = {
  id: string;
  fund_name: string;
  fund_code?: string;
  amount: number;
  debit_date?: string;
  start_date?: string;
  status: 'active' | 'paused';
  total_invested: number;
  current_value: number;
  units: number;
  nav?: number;
  lump_sum?: number;
  lump_sums?: LumpSumEntry[];
  missed_amount?: number;
  missed_entries?: LumpSumEntry[];
};

/** Total amount actually invested into a fund: SIP installments to date + lump sums, minus missed installments. */
export function computeAutoInvested(sip: SIP): number {
  const amount = Number(sip.amount ?? 0);
  const legacyLump = Number(sip.lump_sum ?? 0);
  const arrayLump = (sip.lump_sums ?? []).reduce((a, ls) => a + Number(ls.amount), 0);
  const totalLump = legacyLump + arrayLump;
  // missed_entries array takes priority over legacy scalar
  const missedEntries = sip.missed_entries ?? [];
  const missed = missedEntries.length > 0
    ? missedEntries.reduce((a, m) => a + Number(m.amount), 0)
    : Number(sip.missed_amount ?? 0);

  if (!sip.start_date || !sip.debit_date) return Math.max(0, totalLump - missed);

  const start = new Date(sip.start_date);
  const debitDay = new Date(sip.debit_date).getDate();
  const today = new Date();
  let count = 0;
  const cur = new Date(start.getFullYear(), start.getMonth(), debitDay);
  while (cur <= today) {
    count++;
    cur.setMonth(cur.getMonth() + 1);
  }
  return Math.max(0, count * amount + totalLump - missed);
}

/** Current value of a fund: manually-tracked current_value where set, otherwise its invested amount. */
export function computeCurrentValue(sip: SIP): number {
  const cv = Number(sip.current_value ?? 0);
  return cv > 0 ? cv : computeAutoInvested(sip);
}
