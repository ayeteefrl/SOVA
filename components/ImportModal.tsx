'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  detectTextFile,
  detectXLSX,
  detectPDF,
  parseWithColumnMap,
  FIELD_DEFS,
  type ImportRow,
  type ColumnMap,
  type DetectResult,
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

function ModalContent({ onClose, onImported }: { onClose: () => void; onImported?: (count: number) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [detecting, setDetecting] = useState(false);

  // Detection result
  const [detected, setDetected] = useState<DetectResult | null>(null);
  // User-editable column map (copy of detected.columnMap that user can override)
  const [columnMap, setColumnMap] = useState<ColumnMap>({ ticker: -1, name: -1, units: -1, price: -1, date: -1, action: -1, sector: -1, broker: -1, assetType: -1 });

  // Parsed rows (after mapping step)
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // Import state
  const [submitting, setSubmitting] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const processFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setUploadError('');
    setDetecting(true);
    try {
      let result: DetectResult;
      const lower = file.name.toLowerCase();
      if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
        const text = await file.text();
        result = detectTextFile(text);
      } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        result = await detectXLSX(file);
      } else if (lower.endsWith('.pdf')) {
        result = await detectPDF(file);
      } else {
        setUploadError('Unsupported file type. Please upload CSV, XLSX, or PDF.');
        setDetecting(false);
        return;
      }

      if (result.headers.length === 0) {
        setUploadError('Could not read the file. Make sure it has data and column headers.');
        setDetecting(false);
        return;
      }

      setDetected(result);
      setColumnMap({ ...result.columnMap });
      setStep('mapping');
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

  function handleConfirmMapping() {
    if (!detected) return;
    const result = parseWithColumnMap(detected.rawLines, detected.separator, columnMap);
    setRows(result.rows);
    setParseErrors(result.errors);
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
    setDetected(null);
    setRows([]);
    setParseErrors([]);
    setImportErrors([]);
    setFileName('');
    setUploadError('');
  }

  const canProceed = (columnMap.ticker >= 0 || columnMap.name >= 0) && columnMap.units >= 0 && columnMap.price >= 0;

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
            <div className="hidden sm:flex items-center gap-1.5 mr-4">
              {(['upload', 'mapping', 'preview'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black transition-all',
                    step === s ? 'bg-[#4d8eff] text-white' :
                    ['mapping', 'preview', 'done'].indexOf(step) > i ? 'bg-[#4edea3]/20 text-[#4edea3]' :
                    'bg-[#2f3445] text-[#424754]'
                  )}>{i + 1}</div>
                  {i < 2 && <div className={cn('w-6 h-px', ['mapping', 'preview', 'done'].indexOf(step) > i ? 'bg-[#4edea3]/40' : 'bg-[#2f3445]')} />}
                </div>
              ))}
            </div>
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

              {/* ── Step 2: Column Mapping ── */}
              {step === 'mapping' && detected && (
                <motion.div key="mapping" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-black text-[#dde2f8]">{fileName}</p>
                      <p className="text-[10px] text-[#8c909f] mt-0.5">{detected.headers.length} columns detected · confirm how to use them</p>
                    </div>
                    <button onClick={resetToUpload} className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors">
                      Change file
                    </button>
                  </div>

                  {/* Detected columns preview */}
                  <div className="p-3 rounded-xl flex flex-wrap gap-2" style={fieldStyle}>
                    <p className="w-full text-[9px] font-black uppercase tracking-widest text-[#8c909f] mb-1">Columns found in your file</p>
                    {detected.headers.map((h, i) => (
                      <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[#2f3445] text-[#adc6ff]">{h}</span>
                    ))}
                  </div>

                  {/* Mapping table */}
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f] mb-3">Tell SOVA what each column means</p>
                    <div className="space-y-2">
                      {FIELD_DEFS.map(({ key, label, required, hint }) => {
                        const detected_col = columnMap[key];
                        const isDetected = detected_col >= 0;
                        return (
                          <div key={key} className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-xl',
                            required && !isDetected ? 'bg-[#ffb2b7]/8 ring-1 ring-[#ffb2b7]/20' : 'bg-[#1a2035]/60',
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
                                value={detected_col}
                                onChange={(e) => setColumnMap(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                              >
                                <option value={-1}>— Not in file —</option>
                                {detected.headers.map((h, i) => (
                                  <option key={i} value={i}>{h}</option>
                                ))}
                              </select>
                            </div>
                            {isDetected && (
                              <span className="material-symbols-outlined text-sm text-[#4edea3] shrink-0">check_circle</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!canProceed && (
                    <div className="p-3 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/20">
                      <p className="text-[11px] text-[#D4AF37] font-semibold">
                        Please map <strong>Ticker/Symbol</strong>, <strong>Units</strong>, and <strong>Price</strong> before continuing.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={resetToUpload} className="flex-1 h-12 rounded-lg text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8] transition-colors" style={fieldStyle}>
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
