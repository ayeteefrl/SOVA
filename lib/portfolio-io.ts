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

// Maps each SOVA field to the column index in the user's file (-1 = not mapped)
export interface ColumnMap {
  ticker: number;
  name: number;
  units: number;
  price: number;
  date: number;
  action: number;
  sector: number;
  broker: number;
  assetType: number;
}

export type ColumnMapKey = keyof ColumnMap;

export interface FieldDef {
  key: ColumnMapKey;
  label: string;
  required: boolean;
  hint: string;
}

export const FIELD_DEFS: FieldDef[] = [
  { key: 'ticker',    label: 'Ticker / Symbol', required: true,  hint: 'Stock symbol e.g. RELIANCE, INFY' },
  { key: 'name',      label: 'Company Name',    required: false, hint: 'Full name of the security' },
  { key: 'units',     label: 'Units / Qty',     required: true,  hint: 'Number of shares or units held' },
  { key: 'price',     label: 'Price / Avg Cost', required: true, hint: 'Buy price or average cost per unit' },
  { key: 'date',      label: 'Date',             required: false, hint: 'Trade or purchase date' },
  { key: 'action',    label: 'Action',           required: false, hint: 'Buy or Sell (defaults to Buy)' },
  { key: 'sector',    label: 'Sector',           required: false, hint: 'Industry sector' },
  { key: 'broker',    label: 'Broker',           required: false, hint: 'Broker or platform name' },
  { key: 'assetType', label: 'Asset Type',       required: false, hint: 'Equity, MF, or ETF' },
];

// Column aliases — ordered from most specific to least specific
const ALIASES: Record<ColumnMapKey, string[]> = {
  ticker:    ['ticker', 'symbol', 'scrip code', 'scrip', 'stock code', 'stock', 'code', 'isin', 'nse symbol', 'bse code'],
  name:      ['scrip name', 'stock name', 'company name', 'instrument name', 'security name', 'name', 'instrument', 'company', 'security', 'description'],
  units:     ['no. of shares', 'no of shares', 'number of shares', 'units held', 'quantity', 'shares', 'units', 'qty', 'holding', 'balance qty'],
  price:     ['average price', 'avg cost', 'buy price', 'purchase price', 'cost price', 'acquisition price', 'price paid', 'rate', 'cost', 'avg', 'price'],
  date:      ['trade date', 'purchase date', 'transaction date', 'buy date', 'date of purchase', 'date'],
  action:    ['transaction type', 'buy/sell', 'action', 'transaction', 'type', 'order type'],
  sector:    ['industry group', 'sub-industry', 'sector name', 'industry', 'category', 'sector'],
  broker:    ['trading member', 'platform', 'source', 'exchange', 'broker'],
  assetType: ['instrument type', 'asset class', 'asset type', 'security type', 'class', 'asset'],
};

// ── DETECTION HELPERS ─────────────────────────────────────────────────────────

function stripBOM(text: string): string {
  return text.replace(/^﻿/, '');
}

function detectSeparator(firstLine: string): string {
  const counts: Record<string, number> = {
    ',':  (firstLine.match(/,/g)  ?? []).length,
    ';':  (firstLine.match(/;/g)  ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
    '|':  (firstLine.match(/\|/g) ?? []).length,
  };
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

function splitLine(line: string, sep: string): string[] {
  if (sep !== ',') return line.split(sep).map(c => c.trim());
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

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function autoDetectColumns(rawHeaders: string[]): ColumnMap {
  const headers = rawHeaders.map(normalizeHeader);

  const detect = (aliases: string[]): number => {
    for (const alias of aliases) {
      const normAlias = normalizeHeader(alias);
      const idx = headers.findIndex(h => h === normAlias || h.includes(normAlias) || normAlias.includes(h));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  return {
    ticker:    detect(ALIASES.ticker),
    name:      detect(ALIASES.name),
    units:     detect(ALIASES.units),
    price:     detect(ALIASES.price),
    date:      detect(ALIASES.date),
    action:    detect(ALIASES.action),
    sector:    detect(ALIASES.sector),
    broker:    detect(ALIASES.broker),
    assetType: detect(ALIASES.assetType),
  };
}

// ── FILE DETECTION ────────────────────────────────────────────────────────────

export interface DetectResult {
  separator: string;
  headers: string[];      // raw header strings from the file
  columnMap: ColumnMap;   // auto-detected mapping
  rawLines: string[];     // all lines including header
}

export function detectTextFile(text: string): DetectResult {
  const clean = stripBOM(text);
  const allLines = clean.split(/\r?\n/).filter(l => l.trim());
  if (allLines.length === 0) return { separator: ',', headers: [], columnMap: emptyMap(), rawLines: [] };

  const separator = detectSeparator(allLines[0]);
  const headers = splitLine(allLines[0], separator).map(h => h.replace(/^"|"$/g, '').trim());
  const columnMap = autoDetectColumns(headers);
  return { separator, headers, columnMap, rawLines: allLines };
}

function emptyMap(): ColumnMap {
  return { ticker: -1, name: -1, units: -1, price: -1, date: -1, action: -1, sector: -1, broker: -1, assetType: -1 };
}

// ── PARSE WITH EXPLICIT COLUMN MAP ────────────────────────────────────────────

export function parseWithColumnMap(
  rawLines: string[],
  separator: string,
  map: ColumnMap,
): ImportResult {
  const rows: ImportRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cells = splitLine(rawLines[i], separator);
    const get = (col: number) =>
      col >= 0 && col < cells.length ? cells[col].replace(/^"|"$/g, '').trim() : '';

    const tickerRaw = get(map.ticker) || get(map.name);
    const nameRaw   = get(map.name)   || get(map.ticker);
    const unitsStr  = get(map.units).replace(/,/g, '');
    const priceStr  = get(map.price).replace(/[₹$£€,]/g, '');

    const units = parseFloat(unitsStr);
    const price = parseFloat(priceStr);

    if (!tickerRaw || isNaN(units) || isNaN(price) || units <= 0 || price <= 0) {
      if (tickerRaw || unitsStr || priceStr) {
        errors.push(`Row ${i + 1}: skipped — ${!tickerRaw ? 'missing ticker' : isNaN(units) || units <= 0 ? 'invalid units' : 'invalid price'}`);
      }
      continue;
    }

    const rawAction = get(map.action).toLowerCase();
    const action: 'Buy' | 'Sell' = rawAction.includes('sell') ? 'Sell' : 'Buy';

    const rawDate = get(map.date);
    let date = new Date().toISOString().split('T')[0];
    if (rawDate) {
      try { date = new Date(rawDate).toISOString().split('T')[0]; } catch { /* keep today */ }
    }

    const rawAsset = get(map.assetType).toLowerCase();
    const assetType: ImportRow['assetType'] =
      rawAsset.includes('mf') || rawAsset.includes('mutual') ? 'MF' :
      rawAsset.includes('etf') ? 'ETF' : 'Equity';

    rows.push({
      ticker:    tickerRaw.toUpperCase().replace(/\.(NS|BO|BSE|NSE)$/i, ''),
      name:      nameRaw,
      action,
      units,
      price,
      date,
      sector:    get(map.sector)    || undefined,
      broker:    get(map.broker)    || undefined,
      assetType,
    });
  }

  return { rows, errors };
}

// ── CSV IMPORT ────────────────────────────────────────────────────────────────

export function parseCSV(text: string): ImportResult {
  const { separator, columnMap, rawLines } = detectTextFile(text);

  if (columnMap.ticker < 0 && columnMap.name < 0) {
    return { rows: [], errors: ['No Ticker or Name column found — check your headers or use the column mapper below.'] };
  }
  if (columnMap.units < 0) return { rows: [], errors: ['No Units/Qty column found.'] };
  if (columnMap.price < 0) return { rows: [], errors: ['No Price/Avg Cost column found.'] };

  return parseWithColumnMap(rawLines, separator, columnMap);
}

// ── XLSX IMPORT ───────────────────────────────────────────────────────────────

export async function parseXLSX(file: File): Promise<ImportResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(ws);
  return parseCSV(csv);
}

// Detect columns from an XLSX without fully parsing rows
export async function detectXLSX(file: File): Promise<DetectResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(ws);
  return detectTextFile(csv);
}

// ── PDF IMPORT ────────────────────────────────────────────────────────────────

export async function detectPDF(file: File): Promise<DetectResult> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  // Extract all text items with their Y positions (to group into rows)
  type TextItem = { x: number; y: number; text: string };
  const items: TextItem[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        const [, , , , x, y] = item.transform as number[];
        items.push({ x, y: Math.round(y), text: item.str.trim() });
      }
    }
  }

  if (items.length === 0) {
    return { separator: '\t', headers: [], columnMap: emptyMap(), rawLines: [] };
  }

  // Group by Y position (row), sort by X within each row
  const rowMap = new Map<number, TextItem[]>();
  for (const item of items) {
    const existing = rowMap.get(item.y) ?? [];
    existing.push(item);
    rowMap.set(item.y, existing);
  }

  const sortedRows = Array.from(rowMap.entries())
    .sort((a, b) => b[0] - a[0]) // PDFs Y increases upward, so higher Y = earlier row
    .map(([, rowItems]) => rowItems.sort((a, b) => a.x - b.x).map(i => i.text));

  // Filter rows that have at least 2 columns (skip page headers/footers)
  const dataRows = sortedRows.filter(r => r.length >= 2);
  if (dataRows.length === 0) {
    return { separator: '\t', headers: [], columnMap: emptyMap(), rawLines: [] };
  }

  // Convert to tab-separated lines for the standard parser
  const rawLines = dataRows.map(r => r.join('\t'));
  const headers = dataRows[0];
  const columnMap = autoDetectColumns(headers);

  return { separator: '\t', headers, columnMap, rawLines };
}

// ── CSV EXPORT ────────────────────────────────────────────────────────────────

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

// ── XLSX EXPORT ───────────────────────────────────────────────────────────────

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

// ── PDF EXPORT ────────────────────────────────────────────────────────────────

export async function exportPDF(holdings: Holding[], totalValue: number, filename = 'portfolio.pdf') {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

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
    styles: { fontSize: 7.5, cellPadding: 2.5, textColor: [221, 226, 248], fillColor: [15, 21, 38], lineColor: [47, 52, 69], lineWidth: 0.2 },
    headStyles: { fillColor: [29, 36, 56], textColor: [140, 144, 159], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [20, 28, 48] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        const val = parseFloat(String(data.cell.raw));
        if (!isNaN(val)) doc.setTextColor(val >= 0 ? 78 : 255, val >= 0 ? 222 : 178, val >= 0 ? 163 : 183);
      }
    },
  });

  doc.save(filename);
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
