/* ── Sync a logged trade into its dedicated sleeve ─────────────────────────
   The generic "New Trade" ticket always writes an audit record to
   /api/trades (user_trades) for the Activity Ledger. But Mutual Fund, ETF,
   PPF and Real Estate each have their own dedicated table + page
   (user_sips, user_etfs, user_ppf_contributions, user_real_estate) that the
   ledger insert never touches — so a trade logged there would never show up
   on the actual sleeve page. This finds-or-creates the matching record so
   the trade is reflected immediately. Equity/Cash are unaffected: Equity is
   already driven by HoldingsContext, and Cash has no dedicated sleeve page.
   Best-effort by design — the Activity Ledger entry is already the
   authoritative record of the transaction, so failures here are swallowed.
────────────────────────────────────────────────────────────────────────────── */

import { getFY } from '@/lib/ppf';

export interface SyncTradeParams {
  assetType: string;
  orderType: string;
  instrument: string;
  ticker?: string;
  units: number;
  price: number;
  amount: number;
  date: string; // yyyy-mm-dd
}

export async function syncAssetHolding(params: SyncTradeParams): Promise<void> {
  try {
    switch (params.assetType) {
      case 'Mutual Fund':
        await syncMutualFund(params);
        break;
      case 'ETF':
        await syncETF(params);
        break;
      case 'PPF':
        await syncPPF(params);
        break;
      case 'Real Estate':
        await syncRealEstate(params);
        break;
      default:
        break;
    }
  } catch {
    /* best-effort — the Activity Ledger entry already recorded the transaction */
  }
}

async function syncMutualFund({ orderType, instrument, amount, date }: SyncTradeParams) {
  if (!['SIP', 'Lumpsum', 'Redeem'].includes(orderType) || amount <= 0) return;

  const res = await fetch('/api/sips');
  if (!res.ok) return;
  const sips: Array<{ id: string; fund_name: string; lump_sums?: { date: string; amount: number; note?: string }[] }> = await res.json();
  const match = sips.find((s) => s.fund_name.trim().toLowerCase() === instrument.trim().toLowerCase());
  const signedAmount = orderType === 'Redeem' ? -amount : amount;

  if (match) {
    const lump_sums = [...(match.lump_sums ?? []), { date, amount: signedAmount, note: orderType }];
    await fetch(`/api/sips/${match.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lump_sums }),
    });
  } else if (orderType !== 'Redeem') {
    // Brand-new fund — nothing to redeem against, so only SIP/Lumpsum create it.
    // Only lump_sums[] carries the Lumpsum amount here — the page's
    // computeAutoInvested/buildTransactions sum the legacy lump_sum scalar
    // AND every lump_sums[] entry independently, so setting both to the
    // same amount would double-count this contribution.
    await fetch('/api/sips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fund_name: instrument,
        amount: orderType === 'SIP' ? amount : 0,
        start_date: orderType === 'SIP' ? date : undefined,
        debit_date: orderType === 'SIP' ? date : undefined,
        lump_sums: orderType === 'Lumpsum' ? [{ date, amount, note: 'Lumpsum' }] : [],
      }),
    });
  }
}

async function syncETF({ orderType, instrument, ticker, units, price }: SyncTradeParams) {
  if (!['Buy', 'Sell'].includes(orderType) || units <= 0) return;

  const res = await fetch('/api/etfs');
  if (!res.ok) return;
  const etfs: Array<{ id: string; name: string; ticker: string; units: number; avg_cost: number }> = await res.json();
  const key = (ticker || instrument).toUpperCase();
  const match = etfs.find((e) => e.ticker?.toUpperCase() === key || e.name.toLowerCase() === instrument.toLowerCase());

  if (match) {
    const isBuy = orderType === 'Buy';
    const newUnits = isBuy ? match.units + units : Math.max(0, match.units - units);
    const newAvgCost = isBuy && units > 0
      ? (match.units * match.avg_cost + units * price) / (match.units + units)
      : match.avg_cost;
    await fetch(`/api/etfs/${match.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ units: newUnits, avg_cost: newAvgCost, ...(price > 0 ? { current_price: price } : {}) }),
    });
  } else if (orderType === 'Buy') {
    await fetch('/api/etfs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: instrument, ticker: ticker || instrument.toUpperCase(), units, avg_cost: price, current_price: price }),
    });
  }
  // Sell against an untracked ETF has nothing to reduce — skip silently.
}

async function syncPPF({ orderType, amount, date }: SyncTradeParams) {
  // 'Interest Credit' is deliberately excluded: the PPF page already computes
  // interest automatically each FY from the opening balance and rate
  // (calcPPFAnnualInterest) — recording it here too would double-count it.
  if (!['Deposit', 'Partial Withdrawal'].includes(orderType) || amount <= 0) return;

  const signedAmount = orderType === 'Partial Withdrawal' ? -amount : amount;
  await fetch('/api/ppf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fy: getFY(date), deposit_date: date, amount: signedAmount }),
  });
}

async function syncRealEstate({ orderType, instrument, amount }: SyncTradeParams) {
  if (!['Deposit', 'Appreciation'].includes(orderType) || amount <= 0) return;

  const res = await fetch('/api/real-estate');
  if (!res.ok) return;
  const properties: Array<{ id: string; name: string; purchase_price: number; current_value: number }> = await res.json();
  const match = properties.find((p) => p.name.trim().toLowerCase() === instrument.trim().toLowerCase());

  if (match) {
    const updates = orderType === 'Appreciation'
      ? { current_value: match.current_value + amount }
      : { purchase_price: match.purchase_price + amount, current_value: match.current_value + amount };
    await fetch(`/api/real-estate/${match.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  } else if (orderType === 'Deposit') {
    // Brand-new property purchase
    await fetch('/api/real-estate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: instrument, purchase_price: amount, current_value: amount }),
    });
  }
  // Rent Income has no running total on the property record — the Activity
  // Ledger entry (via /api/trades) is its authoritative record.
}
