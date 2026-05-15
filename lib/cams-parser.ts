// CAMS CAS (Consolidated Account Statement) PDF parser
// Works with PDFs downloaded from mfcentral.com → Statements → CAS
// Uses pdfjs-dist (already installed) for server-side text extraction

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

// ── Text extraction via pdfjs-dist ────────────────────────────────────────────

async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  // pdfjs-dist v5 legacy build — works in Node.js without a DOM/canvas
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? '')
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n');
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

function cleanAmount(s: string): number {
  return parseFloat(s.replace(/[₹,\s]/g, '')) || 0;
}

function cleanUnits(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

// CAMS CAS PDF format reference:
// - Investor name appears near top: "Name: FIRSTNAME LASTNAME"
// - PAN: "PAN: ABCDE1234F"
// - AMC header line: "ADITYA BIRLA SUN LIFE MUTUAL FUND"
// - Folio: "Folio No: 1234567/89"
// - Scheme: scheme name on its own line
// - Units: "Units: 500.234"
// - NAV: "NAV: 246.78 (as on DD-Mon-YYYY)"
// - Current Value: "Current Value: 1,23,456.78"
// - Cost Value: "Purchase Cost / Invested Value: 1,00,000.00"

export function parseCASText(text: string): CAMSParseResult {
  const errors: string[] = [];
  const holdings: CAMSHolding[] = [];

  // Extract investor name
  const nameMatch = text.match(/Name\s*[:\-]\s*([A-Z][A-Z\s]{2,60})/i);
  const investorName = nameMatch ? nameMatch[1].trim() : '';

  // Extract PAN
  const panMatch = text.match(/PAN\s*[:\-]\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
  const pan = panMatch ? panMatch[1].toUpperCase() : '';

  // Split text into folio blocks — each folio starts with "Folio No:"
  const folioBlocks = text.split(/Folio\s*No\s*[:\-]/i).slice(1);

  for (const block of folioBlocks) {
    try {
      // Folio number
      const folioMatch = block.match(/^[\s]*([0-9A-Z\/\-]+)/i);
      const folioNo = folioMatch ? folioMatch[1].trim() : '';

      // Scheme name — typically the first long text line after folio
      const schemeMatch = block.match(/\n([A-Z][A-Z0-9\s\-\(\)\/]+(?:FUND|PLAN|GROWTH|DIVIDEND|DIRECT)[A-Z0-9\s\-\(\)\/]*)/i);
      const schemeName = schemeMatch ? schemeMatch[1].trim() : '';

      // ISIN
      const isinMatch = block.match(/ISIN\s*[:\-]?\s*([A-Z]{2}[A-Z0-9]{10})/i);
      const isin = isinMatch ? isinMatch[1] : '';

      // Units
      const unitsMatch = block.match(/(?:Balance\s*Units|Units\s*[:\-])\s*([\d,\.]+)/i);
      const units = unitsMatch ? cleanUnits(unitsMatch[1]) : 0;

      // NAV
      const navMatch = block.match(/NAV\s*[:\-]?\s*(?:₹|Rs\.?)?\s*([\d,\.]+)/i);
      const nav = navMatch ? cleanAmount(navMatch[1]) : 0;

      // Current value
      const valueMatch = block.match(/(?:Current\s*Value|Market\s*Value)\s*[:\-]?\s*(?:₹|Rs\.?)?\s*([\d,\.]+)/i);
      const currentValue = valueMatch ? cleanAmount(valueMatch[1]) : units * nav;

      // Cost / invested value
      const costMatch = block.match(/(?:Purchase\s*Cost|Invested\s*Value|Cost\s*Value)\s*[:\-]?\s*(?:₹|Rs\.?)?\s*([\d,\.]+)/i);
      const costValue = costMatch ? cleanAmount(costMatch[1]) : 0;

      // Purchase date
      const dateMatch = block.match(/(?:First\s*Purchase|Purchase\s*Date)\s*[:\-]?\s*(\d{1,2}[-\/]\w{3,9}[-\/]\d{4})/i);
      const purchaseDate = dateMatch ? dateMatch[1] : undefined;

      // AMC name — typically appears before the folio block; look for known AMC patterns
      const amcMatch = block.match(/([A-Z][A-Z\s]+(?:MUTUAL\s*FUND|ASSET\s*MANAGEMENT))/i);
      const amcName = amcMatch ? amcMatch[1].trim() : '';

      if (units > 0 && (schemeName || isin)) {
        holdings.push({ folioNo, schemeName, amcName, isin, units, nav, currentValue, costValue, purchaseDate });
      }
    } catch {
      errors.push(`Failed to parse folio block starting with: ${block.slice(0, 40)}`);
    }
  }

  if (holdings.length === 0) {
    errors.push('No holdings found. Make sure you uploaded a CAMS/KFintech CAS PDF from mfcentral.com.');
  }

  return { investorName, pan, holdings, errors };
}

export async function parseCASPDF(buffer: ArrayBuffer): Promise<CAMSParseResult> {
  const text = await extractPDFText(buffer);
  return parseCASText(text);
}
