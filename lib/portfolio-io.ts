// Import/Export utilities for portfolio data (CSV, XLSX, PDF)
// Runs client-side only — do not import in server code

import type { Holding } from './data';

export interface ImportRow {
  ticker: string;
  name: string;
  action: 'Buy' | 'Sell';
  units: number;
  price: number;
  date: string;
  sector?: string;
  broker?: string;
  assetType?: 'Equity' | 'MF' | 'ETF';
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
}

// ── CSV EXPORT ───────────────────────────────────────────────────────────────

export function exportCSV(holdings: Holding[], filename = 'portfolio.csv') {
  const headers = ['Ticker', 'Name', 'Units', 'Avg Cost (₹)', 'LTP (₹)', 'Value (₹)', 'Invested (₹)', 'Unrealised P&L (₹)', 'Total Return (%)', 'Day Change (%)', 'Weight (%)', 'Sector'];
  const rows = holdings.map((h) => [
    h.ticker ?? h.name,
    h.name,
    h.units,
    h.avgCost.toFixed(2),
    h.ltp.toFixed(2),
    h.value.toFixed(2),
    (h.units * h.avgCost).toFixed(2),
    (h.value - h.units * h.avgCost).toFixed(2),
    h.total.toFixed(2),
    h.daily.toFixed(2),
    h.weight.toFixed(2),
    h.sector ?? '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  download(csv, filename, 'text/csv');
}

// ── XLSX EXPORT ──────────────────────────────────────────────────────────────

export async function exportXLSX(holdings: Holding[], filename = 'portfolio.xlsx') {
  const XLSX = await import('xlsx');

  const data = [
    ['Ticker', 'Name', 'Units', 'Avg Cost (₹)', 'LTP (₹)', 'Value (₹)', 'Invested (₹)', 'Unrealised P&L (₹)', 'Total Return (%)', 'Day Change (%)', 'Weight (%)', 'Sector'],
    ...holdings.map((h) => [
      h.ticker ?? h.name,
      h.name,
      h.units,
      h.avgCost,
      h.ltp,
      h.value,
      h.units * h.avgCost,
      h.value - h.units * h.avgCost,
      h.total,
      h.daily,
      h.weight,
      h.sector ?? '',
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = data[0].map(() => ({ wch: 16 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Portfolio');
  XLSX.writeFile(wb, filename);
}

// ── PDF EXPORT ───────────────────────────────────────────────────────────────

export async function exportPDF(holdings: Holding[], totalValue: number, filename = 'portfolio.pdf') {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Header
  doc.setFillColor(13, 19, 34);
  doc.rect(0, 0, 297, 297, 'F');

  doc.setTextColor(173, 198, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('SOVA — Portfolio Report', 14, 18);

  doc.setTextColor(140, 144, 159);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  doc.text(`Generated ${dateStr}  ·  Total Value: ₹${totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, 14, 26);

  autoTable(doc, {
    startY: 32,
    head: [['Ticker', 'Name', 'Units', 'Avg Cost', 'LTP', 'Value', 'Invested', 'P&L', 'Return %', 'Day %', 'Wt.%', 'Sector']],
    body: holdings.map((h) => [
      h.ticker ?? h.name,
      h.name.length > 18 ? h.name.slice(0, 16) + '…' : h.name,
      h.units.toLocaleString('en-IN'),
      `₹${h.avgCost.toFixed(0)}`,
      `₹${h.ltp.toFixed(0)}`,
      `₹${h.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      `₹${(h.units * h.avgCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      `₹${(h.value - h.units * h.avgCost).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      `${h.total >= 0 ? '+' : ''}${h.total.toFixed(1)}%`,
      `${h.daily >= 0 ? '+' : ''}${h.daily.toFixed(2)}%`,
      `${h.weight.toFixed(1)}%`,
      h.sector ?? '—',
    ]),
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      textColor: [221, 226, 248],
      fillColor: [15, 21, 38],
      lineColor: [47, 52, 69],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [29, 36, 56],
      textColor: [140, 144, 159],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: [20, 28, 48] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const val = parseFloat(String(data.cell.raw));
        if (!isNaN(val)) {
          doc.setTextColor(val >= 0 ? 78 : 255, val >= 0 ? 222 : 178, val >= 0 ? 163 : 183);
        }
      }
    },
  });

  doc.save(filename);
}

// ── CSV IMPORT ───────────────────────────────────────────────────────────────

export function parseCSV(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['File is empty or missing data rows'] };

  const headers = lines[0].split(',').map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());

  const colOf = (candidates: string[]) =>
    candidates.reduce<number>((found, c) => (found >= 0 ? found : headers.findIndex((h) => h.includes(c))), -1);

  const tickerCol  = colOf(['ticker', 'symbol', 'scrip', 'stock']);
  const nameCol    = colOf(['name', 'instrument', 'company']);
  const unitsCol   = colOf(['units', 'qty', 'quantity', 'shares']);
  const priceCol   = colOf(['price', 'avg', 'cost', 'rate', 'buy price']);
  const dateCol    = colOf(['date', 'trade date', 'purchase date']);
  const actionCol  = colOf(['action', 'type', 'transaction', 'buy/sell']);
  const sectorCol  = colOf(['sector', 'industry', 'category']);
  const brokerCol  = colOf(['broker', 'platform', 'source']);
  const assetCol   = colOf(['asset', 'class', 'instrument type']);

  if (tickerCol < 0 && nameCol < 0) {
    return { rows: [], errors: ['Cannot find a Ticker or Name column. Ensure your CSV has headers.'] };
  }
  if (unitsCol < 0) return { rows: [], errors: ['Cannot find a Units/Qty column'] };
  if (priceCol < 0) return { rows: [], errors: ['Cannot find a Price/Avg Cost column'] };

  const rows: ImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCSVLine(lines[i]);
    const get = (col: number) => (col >= 0 ? cells[col]?.replace(/^"|"$/g, '').trim() : '');

    const ticker = get(tickerCol) || get(nameCol);
    const name   = get(nameCol)   || get(tickerCol);
    const units  = parseFloat(get(unitsCol).replace(/,/g, ''));
    const price  = parseFloat(get(priceCol).replace(/[₹,]/g, ''));

    if (!ticker || isNaN(units) || isNaN(price) || units <= 0 || price <= 0) {
      errors.push(`Row ${i + 1}: skipped — missing or invalid data`);
      continue;
    }

    const rawAction = get(actionCol).toLowerCase();
    const action: 'Buy' | 'Sell' = rawAction.includes('sell') ? 'Sell' : 'Buy';

    const rawDate = get(dateCol);
    const date = rawDate ? new Date(rawDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    const rawAsset = get(assetCol).toLowerCase();
    const assetType: ImportRow['assetType'] =
      rawAsset.includes('mf') || rawAsset.includes('mutual') ? 'MF' :
      rawAsset.includes('etf') ? 'ETF' : 'Equity';

    rows.push({
      ticker: ticker.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, ''),
      name,
      action,
      units,
      price,
      date,
      sector: get(sectorCol) || undefined,
      broker: get(brokerCol) || undefined,
      assetType,
    });
  }

  return { rows, errors };
}

// ── XLSX IMPORT ──────────────────────────────────────────────────────────────

export async function parseXLSX(file: File): Promise<ImportResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_csv(ws);
  return parseCSV(data);
}

// ── HELPERS ──────────────────────────────────────────────────────────────────

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}
