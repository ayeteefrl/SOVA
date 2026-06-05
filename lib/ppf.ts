/* ── PPF computation utilities ─────────────────────────────────────────────
   Shared between the PPF portfolio page and the /api/ppf/corpus route.
   All functions are pure — no browser APIs, safe to use server-side.
────────────────────────────────────────────────────────────────────────────── */

export type Contribution = {
  id: string;
  fy: string;
  deposit_date: string;
  amount: number;
  interest_for_year: number;
  closing_balance: number;
  interest_rate: number;
};

export type ProcessedRow = Contribution & {
  rowType: 'deposit' | 'ytd-accrued' | 'year-end-credited';
  projectedFullYearInterest?: number;
};

/** Indian FY: April 1 → March 31. Jan/Feb/Mar belong to the previous year's FY. */
export function getFY(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const year = d.getFullYear();
  const fyStart = month >= 4 ? year : year - 1;
  return `FY ${fyStart}-${String(fyStart + 1).slice(-2)}`;
}

/**
 * Compute PPF annual interest for a full financial year.
 * Uses the monthly min-balance rule: deposits on/before the 5th of a month
 * count for that month; after the 5th they count from the following month.
 * Interest is credited in one lump on March 31.
 */
export function calcPPFAnnualInterest(
  deposits: { date: string; amount: number }[],
  openingBalance: number,
  rate: number,
  fyStartYear: number,
): number {
  const monthlyRate = rate / 1200;
  let balance = openingBalance;
  let total = 0;
  for (let m = 0; m < 12; m++) {
    const monthIdx = (3 + m) % 12; // Apr=3 … Mar=2
    const year = monthIdx >= 3 ? fyStartYear : fyStartYear + 1;
    for (const dep of deposits) {
      const d = new Date(dep.date);
      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() <= 5) balance += dep.amount;
    }
    total += Math.round(balance * monthlyRate);
    for (const dep of deposits) {
      const d = new Date(dep.date);
      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() > 5) balance += dep.amount;
    }
  }
  return total;
}

/**
 * Compute PPF YTD interest estimate for the current (incomplete) financial year.
 * Returns how much has accrued month-by-month up to today, plus the full-year
 * projection if no further deposits are made.
 */
export function calcPPFYTD(
  deposits: { date: string; amount: number }[],
  openingBalance: number,
  rate: number,
  fyStartYear: number,
): { accrued: number; projectedFullYear: number } {
  const monthlyRate = rate / 1200;
  const today = new Date();
  let balance = openingBalance;
  let accrued = 0;
  let projectedFullYear = 0;

  for (let m = 0; m < 12; m++) {
    const monthIdx = (3 + m) % 12;
    const year = monthIdx >= 3 ? fyStartYear : fyStartYear + 1;

    for (const dep of deposits) {
      const d = new Date(dep.date);
      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() <= 5) balance += dep.amount;
    }

    const monthInterest = Math.round(balance * monthlyRate);
    projectedFullYear += monthInterest;

    const elapsed =
      year < today.getFullYear() ||
      (year === today.getFullYear() && monthIdx < today.getMonth()) ||
      (year === today.getFullYear() && monthIdx === today.getMonth());
    if (elapsed) accrued += monthInterest;

    for (const dep of deposits) {
      const d = new Date(dep.date);
      if (d.getFullYear() === year && d.getMonth() === monthIdx && d.getDate() > 5) balance += dep.amount;
    }
  }
  return { accrued, projectedFullYear };
}

/**
 * Build display rows from raw contributions.
 * Each deposit row is followed by a year-end credit row (past FYs) or a
 * YTD estimate row (current FY).
 */
export function processContributions(raw: Contribution[], rate: number): ProcessedRow[] {
  if (raw.length === 0) return [];

  const sorted = [...raw]
    .map(c => ({ ...c, fy: getFY(c.deposit_date) }))
    .sort((a, b) => a.deposit_date.localeCompare(b.deposit_date));

  const fyGroups = new Map<string, Contribution[]>();
  for (const c of sorted) {
    if (!fyGroups.has(c.fy)) fyGroups.set(c.fy, []);
    fyGroups.get(c.fy)!.push(c);
  }

  const sortedFYKeys = Array.from(fyGroups.keys()).sort();
  const result: ProcessedRow[] = [];
  let openingBalance = 0;
  const todayFY = getFY(new Date().toISOString().slice(0, 10));

  for (const fy of sortedFYKeys) {
    const deps = fyGroups.get(fy)!;
    let runningBalance = openingBalance;

    for (const dep of deps) {
      runningBalance += dep.amount;
      result.push({
        ...dep,
        fy,
        interest_for_year: 0,
        closing_balance: runningBalance,
        interest_rate: rate,
        rowType: 'deposit',
      });
    }

    const fyStartYear = parseInt(fy.slice(3, 7));
    const depInputs = deps.map(d => ({ date: d.deposit_date, amount: d.amount }));

    if (fy < todayFY) {
      const interest = calcPPFAnnualInterest(depInputs, openingBalance, rate, fyStartYear);
      const closing = runningBalance + interest;
      result.push({
        id: `${fy}-credited`,
        fy,
        deposit_date: `${fyStartYear + 1}-03-31`,
        amount: 0,
        interest_for_year: interest,
        closing_balance: closing,
        interest_rate: rate,
        rowType: 'year-end-credited',
      });
      openingBalance = closing;
    } else if (fy === todayFY) {
      const { accrued, projectedFullYear } = calcPPFYTD(depInputs, openingBalance, rate, fyStartYear);
      if (projectedFullYear > 0) {
        result.push({
          id: `${fy}-ytd`,
          fy,
          deposit_date: new Date().toISOString().slice(0, 10),
          amount: 0,
          interest_for_year: accrued,
          closing_balance: runningBalance + accrued,
          interest_rate: rate,
          rowType: 'ytd-accrued',
          projectedFullYearInterest: projectedFullYear,
        });
        openingBalance = runningBalance + accrued;
      } else {
        openingBalance = runningBalance;
      }
    } else {
      openingBalance = runningBalance;
    }
  }

  return result;
}

/** Derive the key corpus summary figures from raw contributions + rate. */
export function derivePPFCorpus(
  raw: Contribution[],
  rate: number,
): { corpus: number; totalDeposited: number; totalInterest: number } {
  const rows = processContributions(raw, rate);
  const corpus = rows[rows.length - 1]?.closing_balance ?? 0;
  const totalDeposited = rows
    .filter(r => r.rowType === 'deposit')
    .reduce((a, c) => a + c.amount, 0);
  const totalInterest = rows
    .filter(r => r.rowType !== 'deposit')
    .reduce((a, c) => a + c.interest_for_year, 0);
  return { corpus, totalDeposited, totalInterest };
}
