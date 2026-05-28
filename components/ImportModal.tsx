'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  detectTextFile,
  detectXLSXAllSheets,
  detectPDF,
  wrapSingleSheet,
  parseWithColumnMap,
  FIELD_DEFS,
  type ImportRow,
  type ColumnMap,
  type SheetDetect,
} from '@/lib/portfolio-io';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (count: number) => void;
}

const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };

const selectStyle: React.CSSProperties = {
  background: '#1a2035',
  border: '1px solid #2f3445',
  color: '#dde2f8',
  borderRadius: '8px',
  padding: '6px 10px',
  fontSize: '11px',
  fontWeight: 700,
  outline: 'none',
  width: '100%',
};

// A SOVA field is satisfied if it has at least a ticker-or-name plus units + price.
function mapOk(m: ColumnMap): boolean {
  return (m.ticker >= 0 || m.name >= 0) && m.units >= 0 && m.price >= 0;
}

function ModalContent({ onClose, onImported }: { onClose: () => void; onImported?: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'sheets' | 'mapping' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [detecting, setDetecting] = useState(false);

  // Every sheet found in the file (CSV/PDF collapse to a single sheet)
  const [sheets, setSheets] = useState<SheetDetect[]>([]);
  // Names of the sheets the user chose to import
  const [selected, setSelected] = useState<string[]>([]);
  // Per-sheet column map (keyed by sheet name), user-overridable
  const [maps, setMaps] = useState<Record<string, ColumnMap>>({});

  // Parsed rows (after mapping step)
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Import state
  const [submitting, setSubmitting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const multiSheet = sheets.length > 1;

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadError('');
    setDetecting(true);
    try {
      let detectedSheets: SheetDetect[];
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        detectedSheets = [wrapSingleSheet('Imported data', detectTextFile(text))];
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        detectedSheets = await detectXLSXAllSheets(file);
      } else if (lower.endsWith('.pdf')) {
        detectedSheets = [wrapSingleSheet('PDF table', await detectPDF(file))];
      } else {
        setUploadError('Unsupported file type. Please upload CSV, XLSX, or PDF.');
        setDetecting(false);
        return;
      }

      detectedSheets = detectedSheets.filter((s) => s.headers.length > 0);
      if (detectedSheets.length === 0) {
        setUploadError('Could not read the file. Make sure it has data and column headers.');
        setDetecting(false);
        return;
      }

      setSheets(detectedSheets);
      setMaps(Object.fromEntries(detectedSheets.map((s) => [s.name, { ...s.columnMap }])));

      // Pre-select the sheets that already look like holdings tables.
      const importable = detectedSheets.filter((s) => mapOk(s.columnMap)).map((s) => s.name);

      if (detectedSheets.length > 1) {
        setSelected(importable.length ? importable : [detectedSheets[0].name]);
        setStep('sheets');
      } else {
        setSelected([detectedSheets[0].name]);
        setStep('mapping');
      }
    } catch (err) {
      setUploadError('Failed to read the file. Try saving it as CSV and re-uploading.');
    } finally {
      setDetecting(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  function toggleSheet(name: string) {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function updateMap(sheet: string, key: keyof ColumnMap, col: number) {
    setMaps((prev) => ({ ...prev, [sheet]: { ...prev[sheet], [key]: col } }));
  }

  function handleConfirmMapping() {
    const allRows: ImportRow[] = [];
    const errs: string[] = [];
    for (const name of selected) {
      const sheet = sheets.find((s) => s.name === name);
      if (!sheet) continue;
      const res = parseWithColumnMap(sheet.rawLines, sheet.separator, maps[name]);
      allRows.push(...res.rows);
      errs.push(...res.errors.map((e) => (multiSheet ? `[${name}] ${e}` : e)));
    }
    setRows(allRows);
    setParseErrors(errs);
    setStep('preview');
  }

  async function handleImport() {
    setSubmitting(true);
    const failed: string[] = [];

    for (const row of rows) {
      try {
        const assetClass = row.assetType === 'MF' ? 'MF' : row.assetType === 'ETF' ? 'ETF' : 'Equity';
        await fetch('/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset_class: assetClass,
            instrument_name: row.name || row.ticker,
            ticker: row.ticker,
            action: row.action,
            units: row.units,
            price: row.price,
            amount: row.units * row.price,
            trade_date: new Date(row.date).toISOString(),
            notes: row.broker ? `via ${row.broker}` : 'Imported',
            sector: row.sector,
          }),
        });
      } catch {
        failed.push(row.ticker);
      }
    }

    setSubmitting(false);
    if (failed.length > 0) setImportErrors([`Failed to import: ${failed.join(', ')}`]);
    setStep('done');
    window.dispatchEvent(new Event('sova:refresh'));
    onImported?.(rows.length - failed.length);
  }

  function resetToUpload() {
    setStep('upload');
    setSheets([]);
    setSelected([]);
    setMaps({});
    setRows([]);
    setParseErrors([]);
    setImportErrors([]);
    setFileName('');
    setUploadError('');
  }

  // Every selected sheet must have its required fields mapped.
  const canProceed = selected.length > 0 && selected.every((n) => maps[n] && mapOk(maps[n]));

  return (
    <>
      <div className="fixed inset-0 z-[210] bg-[#080e1d]/75 backdrop-blur-xl" onClick={onClose} />
      <div className="fixed inset-0 z-[211] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
          style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />

          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-[#2f3445]/60">
            <div>
              <h2 className="text-xl font-black tracking-tight text-[#dde2f8] flex items-center gap-2.5">
                <span className="material-symbols-outlined text-[#D4AF37]">upload_file</span>
                Import Portfolio
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#8c909f] mt-0.5">
                CSV · Excel · PDF
              </p>
            </div>
            {/* Step indicator */}
            {(() => {
              const flow: string[] = multiSheet
                ? ['upload', 'sheets', 'mapping', 'preview']
                : ['upload', 'mapping', 'preview'];
              const currentIdx = flow.indexOf(step);
              const reached = step === 'done' ? flow.length : currentIdx;
              return (
                <div className="hidden sm:flex items-center gap-1.5 mr-4">
                  {flow.map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                      <div className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all',
                        step === s ? 'bg-[#4d8eff] text-white' :
                        reached > i ? 'bg-[#4edea3]/20 text-[#4edea3]' :
                        'bg-[#2f3445] text-[#424754]'
                      )}>{i + 1}</div>
                      {i < flow.length - 1 && <div className={cn('w-6 h-px', reached > i ? 'bg-[#4edea3]/40' : 'bg-[#2f3445]')} />}
                    </div>
                  ))}
                </div>
              );
            })()}
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#2f3445]/60 text-[#8c909f] hover:text-[#dde2f8] transition-colors">
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div className="p-8 max-h-[75vh] overflow-y-auto scrollbar-thin">
            <AnimatePresence mode="wait">

              {/* ── Step 1: Upload ── */}
              {step === 'upload' && (
                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all border-[#2f3445] hover:border-[#424754] hover:bg-[#1a2035]/50"
                  >
                    {detecting ? (
                      <>
                        <span className="material-symbols-outlined text-5xl text-[#4d8eff] mb-4 block animate-spin" style={{ animationDuration: '1s' }}>progress_activity</span>
                        <p className="text-sm font-black text-[#dde2f8]">Reading file…</p>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-5xl text-[#424754] mb-4 block">cloud_upload</span>
                        <p className="text-sm font-black text-[#dde2f8] mb-1">Drop your file here</p>
                        <p className="text-xs text-[#8c909f]">or click to browse · CSV, XLS, XLSX, PDF supported</p>
                      </>
                    )}
                    <input ref={fileRef} type="file" accept=".csv,.xls,.xlsx,.txt,.pdf" className="hidden" onChange={handleFileChange} />
                  </div>

                  <div className="mt-5 p-4 rounded-xl" style={fieldStyle}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-2">What columns does SOVA look for?</p>
                    <p className="text-[11px] text-[#424754] font-mono leading-relaxed">
                      Ticker / Symbol · Units / Qty · Price / Avg Cost
                    </p>
                    <p className="text-[10px] text-[#424754] mt-2">
                      Also supports: Name, Date, Action, Sector, Broker, Asset Type.
                      Don&apos;t worry about exact names — you can fix column assignments in the next step.
                    </p>
                  </div>

                  {uploadError && (
                    <div className="mt-4 p-4 rounded-xl bg-[#ffb2b7]/10 border border-[#ffb2b7]/20">
                      <p className="text-xs text-[#ffb2b7] font-semibold">{uploadError}</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── Step 2a: Sheet selection (multi-sheet files only) ── */}
              {step === 'sheets' && (
                <motion.div key="sheets" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black text-[#dde2f8]">{fileName}</p>
                      <p className="text-[10px] text-[#8c909f] mt-0.5">{sheets.length} sheets found · choose which to import</p>
                    </div>
                    <button onClick={resetToUpload} className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors">
                      Change file
                    </button>
                  </div>

                  <div className="space-y-2">
                    {sheets.map((s) => {
                      const isSel = selected.includes(s.name);
                      const looksReady = mapOk(s.columnMap);
                      return (
                        <button
                          key={s.name}
                          onClick={() => toggleSheet(s.name)}
                          className={cn(
                            'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                            isSel ? 'bg-[#4d8eff]/10 ring-1 ring-[#4d8eff]/40' : 'bg-[#1a2035]/60 hover:bg-[#1a2035]',
                          )}
                        >
                          <span className={cn(
                            'w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all',
                            isSel ? 'bg-[#4d8eff] text-white' : 'bg-[#2f3445] text-transparent',
                          )}>
                            <span className="material-symbols-outlined text-sm">check</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[12px] font-black text-[#dde2f8] truncate">{s.name}</p>
                            <p className="text-[9px] text-[#8c909f] mt-0.5">
                              {s.rowCount} rows · {s.headers.length} columns
                            </p>
                          </div>
                          <span className={cn(
                            'text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded shrink-0',
                            looksReady ? 'bg-[#4edea3]/15 text-[#4edea3]' : 'bg-[#8c909f]/15 text-[#8c909f]',
                          )}>
                            {looksReady ? 'Holdings detected' : 'Needs mapping'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selected.length === 0 && (
                    <div className="p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                      <p className="text-[11px] text-[#D4AF37] font-semibold">Select at least one sheet to continue.</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={resetToUpload} className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors" style={fieldStyle}>
                      Back
                    </button>
                    <button
                      onClick={() => setStep('mapping')}
                      disabled={selected.length === 0}
                      className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
                      style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}
                    >
                      <span className="material-symbols-outlined text-sm">tune</span>
                      Map Columns
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 2b: Column Mapping (per selected sheet) ── */}
              {step === 'mapping' && selected.length > 0 && (
                <motion.div key="mapping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black text-[#dde2f8]">{fileName}</p>
                      <p className="text-[10px] text-[#8c909f] mt-0.5">
                        {multiSheet ? `Mapping ${selected.length} sheet${selected.length > 1 ? 's' : ''}` : `${sheets[0]?.headers.length ?? 0} columns detected`} · tell SOVA what each column means
                      </p>
                    </div>
                    <button onClick={resetToUpload} className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors">
                      Change file
                    </button>
                  </div>

                  {selected.map((name) => {
                    const sheet = sheets.find((s) => s.name === name);
                    const map = maps[name];
                    if (!sheet || !map) return null;
                    return (
                      <div key={name} className="space-y-3">
                        {multiSheet && (
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[#D4AF37]">tab</span>
                            <p className="text-[11px] font-black uppercase tracking-widest text-[#D4AF37]">{name}</p>
                            <span className="text-[9px] text-[#8c909f]">· {sheet.rowCount} rows</span>
                          </div>
                        )}

                        {/* Detected columns preview */}
                        <div className="p-3 rounded-xl flex flex-wrap gap-2" style={fieldStyle}>
                          <p className="w-full text-[9px] font-black uppercase tracking-widest text-[#8c909f] mb-1">Columns found in this sheet</p>
                          {sheet.headers.map((h, i) => (
                            <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#2f3445] text-[#adc6ff]">{h || `Column ${i + 1}`}</span>
                          ))}
                        </div>

                        {/* Mapping table */}
                        <div className="space-y-2">
                          {FIELD_DEFS.map(({ key, label, required, hint }) => {
                            const col = map[key];
                            const isMapped = col >= 0;
                            return (
                              <div key={key} className={cn(
                                'flex items-center gap-3 px-4 py-3 rounded-xl',
                                required && !isMapped ? 'bg-[#ffb2b7]/8 ring-1 ring-[#ffb2b7]/20' : 'bg-[#1a2035]/60',
                              )}>
                                <div className="w-36 shrink-0">
                                  <p className="text-[11px] font-black text-[#dde2f8] flex items-center gap-1">
                                    {label}
                                    {required && <span className="text-[9px] text-[#ffb2b7]">*</span>}
                                  </p>
                                  <p className="text-[9px] text-[#424754] mt-0.5">{hint}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="material-symbols-outlined text-sm text-[#424754]">arrow_forward</span>
                                </div>
                                <div className="flex-1">
                                  <select
                                    style={selectStyle}
                                    value={col}
                                    onChange={(e) => updateMap(name, key, Number(e.target.value))}
                                  >
                                    <option value={-1}>— Not in this sheet —</option>
                                    {sheet.headers.map((h, i) => (
                                      <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                                    ))}
                                  </select>
                                </div>
                                {isMapped && (
                                  <span className="material-symbols-outlined text-sm text-[#4edea3] shrink-0">check_circle</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {!canProceed && (
                    <div className="p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                      <p className="text-[11px] text-[#D4AF37] font-semibold">
                        Map <strong>Ticker/Symbol</strong>, <strong>Units</strong>, and <strong>Price</strong> for every selected sheet before continuing.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={() => setStep(multiSheet ? 'sheets' : 'upload')} className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors" style={fieldStyle}>
                      Back
                    </button>
                    <button
                      onClick={handleConfirmMapping}
                      disabled={!canProceed}
                      className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:scale-[1.01]"
                      style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}
                    >
                      <span className="material-symbols-outlined text-sm">preview</span>
                      Preview Data
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Preview ── */}
              {step === 'preview' && (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-black text-[#dde2f8]">{fileName}</p>
                      <p className="text-[10px] text-[#8c909f] mt-0.5">{rows.length} rows ready to import</p>
                    </div>
                    <button onClick={() => setStep('mapping')} className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors">
                      Edit columns
                    </button>
                  </div>

                  {parseErrors.length > 0 && (
                    <div className="p-3 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#D4AF37] mb-1">Skipped rows ({parseErrors.length})</p>
                      {parseErrors.slice(0, 5).map((e, i) => <p key={i} className="text-[10px] text-[#D4AF37]/80">{e}</p>)}
                      {parseErrors.length > 5 && <p className="text-[10px] text-[#D4AF37]/60 mt-1">…and {parseErrors.length - 5} more</p>}
                    </div>
                  )}

                  {rows.length === 0 ? (
                    <div className="py-12 text-center">
                      <span className="material-symbols-outlined text-4xl text-[#ffb2b7] block mb-3">error_outline</span>
                      <p className="text-sm font-black text-[#dde2f8]">No valid rows found</p>
                      <p className="text-[10px] text-[#8c909f] mt-1">Check column assignments and try again.</p>
                      <button onClick={() => setStep('mapping')} className="mt-4 px-6 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#adc6ff] hover:bg-[#2f3445] transition-colors">
                        Back to Column Mapping
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl overflow-hidden" style={fieldStyle}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b border-[#2f3445]">
                                {['Ticker', 'Name', 'Action', 'Units', 'Price (₹)', 'Date', 'Type', 'Sector'].map((h) => (
                                  <th key={h} className="px-3 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#8c909f] whitespace-nowrap">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.slice(0, 50).map((row, i) => (
                                <tr key={i} className={cn('border-b border-[#2f3445]/40', i % 2 === 1 && 'bg-[#141c30]/50')}>
                                  <td className="px-3 py-2 text-[11px] font-black text-[#adc6ff]">{row.ticker}</td>
                                  <td className="px-3 py-2 text-[11px] text-[#dde2f8] max-w-[120px] truncate">{row.name || '—'}</td>
                                  <td className="px-3 py-2">
                                    <span className={cn('text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded', row.action === 'Buy' ? 'bg-[#4edea3]/15 text-[#4edea3]' : 'bg-[#ffb2b7]/15 text-[#ffb2b7]')}>{row.action}</span>
                                  </td>
                                  <td className="px-3 py-2 text-[11px] text-[#dde2f8]">{row.units.toLocaleString('en-IN')}</td>
                                  <td className="px-3 py-2 text-[11px] text-[#dde2f8]">₹{row.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                                  <td className="px-3 py-2 text-[10px] text-[#8c909f] whitespace-nowrap">{row.date}</td>
                                  <td className="px-3 py-2 text-[10px] text-[#8c909f]">{row.assetType ?? 'Equity'}</td>
                                  <td className="px-3 py-2 text-[10px] text-[#8c909f] max-w-[80px] truncate">{row.sector ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {rows.length > 50 && (
                          <p className="px-4 py-2 text-[10px] text-[#424754] border-t border-[#2f3445]">
                            Showing first 50 of {rows.length} rows
                          </p>
                        )}
                      </div>

                      <div className="flex gap-3 pt-1">
                        <button onClick={() => setStep('mapping')} className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors" style={fieldStyle}>
                          Edit Columns
                        </button>
                        <button
                          onClick={handleImport}
                          disabled={submitting}
                          className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:scale-[1.01]"
                          style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.25)' }}
                        >
                          {submitting
                            ? <><span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span> Importing…</>
                            : <><span className="material-symbols-outlined text-sm">cloud_done</span> Import {rows.length} Trades</>
                          }
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* ── Step 4: Done ── */}
              {step === 'done' && (
                <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 gap-5">
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(78,222,163,0.15)' }}
                  >
                    <span className="material-symbols-outlined text-4xl text-[#4edea3]">check_circle</span>
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-widest text-[#dde2f8]">Import Complete</p>
                    <p className="text-[10px] text-[#8c909f] font-semibold mt-1">{rows.length} trades logged to Activity Ledger</p>
                    {importErrors.length > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-[#ffb2b7]/10 border border-[#ffb2b7]/20">
                        {importErrors.map((e, i) => <p key={i} className="text-[10px] text-[#ffb2b7]">{e}</p>)}
                      </div>
                    )}
                  </div>
                  <button onClick={onClose} className="px-8 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#dde2f8] hover:bg-[#2f3445] transition-colors" style={fieldStyle}>
                    Close
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export function ImportModal({ open, onClose, onImported }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>{open && <ModalContent onClose={onClose} onImported={onImported} />}</AnimatePresence>,
    document.body,
  );
}
