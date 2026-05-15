// CAS (Consolidated Account Statement) parser — powered by CASParser API
// Docs: https://casparser.in · Auth: x-api-key header
// CAMS PDFs from mfcentral.com are password-protected with the investor's PAN

const CAS_API_BASE = 'https://api.casparser.in';
const CAS_API_KEY = process.env.CAS_API_KEY ?? '';

export interface CAMSHolding {
  folioNo: string;
  schemeName: string;
  amcName: string;
  isin: string;
  units: number;
  nav: number;
  currentValue: number;
  costValue: number;
  purchaseDate?: string;
}

export interface CAMSParseResult {
  investorName: string;
  pan: string;
  holdings: CAMSHolding[];
  errors: string[];
}

// ── CASParser API response types ──────────────────────────────────────────────

interface CASScheme {
  scheme: string;
  isin?: string;
  isin_growth?: string;
  isin_div_reinvestment?: string;
  amfi?: string;
  folio?: string;
  amc?: string;
  units: number;
  nav: number;
  valuation: number;
  cost?: number;
  date?: string;
}

interface CASInvestor {
  name?: string;
  pan?: string;
  email?: string;
  mobile?: string;
}

interface CASAPIResponse {
  investor?: CASInvestor;
  folios?: Array<{
    amc?: string;
    folio?: string;
    schemes?: CASScheme[];
  }>;
  mutual_funds?: Array<{
    amc?: string;
    folio?: string;
    schemes?: CASScheme[];
  }>;
  error?: string;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function parseCASPDF(buffer: ArrayBuffer, password?: string): Promise<CAMSParseResult> {
  const errors: string[] = [];

  if (!CAS_API_KEY) {
    return { investorName: '', pan: '', holdings: [], errors: ['CAS_API_KEY not configured'] };
  }

  const blob = new Blob([buffer], { type: 'application/pdf' });
  const form = new FormData();
  form.append('pdf_file', blob, 'cas.pdf');
  if (password) form.append('password', password);

  let raw: CASAPIResponse;
  try {
    const res = await fetch(`${CAS_API_BASE}/v4/smart/parse`, {
      method: 'POST',
      headers: { 'x-api-key': CAS_API_KEY },
      body: form,
    });
    raw = await res.json();
    if (!res.ok) {
      const msg = raw?.error ?? `CASParser returned ${res.status}`;
      return { investorName: '', pan: '', holdings: [], errors: [msg] };
    }
  } catch (err) {
    return { investorName: '', pan: '', holdings: [], errors: [`CASParser request failed: ${String(err)}`] };
  }

  const investorName = raw.investor?.name ?? '';
  const pan = raw.investor?.pan ?? '';

  // CASParser may return data under `folios` or `mutual_funds` depending on version
  const folioGroups = raw.folios ?? raw.mutual_funds ?? [];

  const holdings: CAMSHolding[] = [];

  for (const group of folioGroups) {
    const amcName = group.amc ?? '';
    const folioNo = group.folio ?? '';
    for (const s of group.schemes ?? []) {
      if ((s.units ?? 0) <= 0) continue;
      const isin = s.isin ?? s.isin_growth ?? s.isin_div_reinvestment ?? '';
      holdings.push({
        folioNo: s.folio ?? folioNo,
        schemeName: s.scheme ?? '',
        amcName: s.amc ?? amcName,
        isin,
        units: s.units,
        nav: s.nav ?? 0,
        currentValue: s.valuation ?? s.units * (s.nav ?? 0),
        costValue: s.cost ?? 0,
        purchaseDate: s.date,
      });
    }
  }

  if (holdings.length === 0) {
    errors.push('No holdings found in the PDF. Make sure you uploaded a CAMS/KFintech CAS PDF and entered the correct password.');
  }

  return { investorName, pan, holdings, errors };
}
