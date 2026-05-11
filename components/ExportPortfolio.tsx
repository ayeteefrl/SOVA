'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { exportCSV, exportXLSX, exportPDF } from '@/lib/portfolio-io';
import type { Holding } from '@/lib/data';

interface Props {
  holdings: Holding[];
  totalValue?: number;
  label?: string;
  compact?: boolean;
}

type Format = 'csv' | 'xlsx' | 'pdf';

export function ExportPortfolio({ holdings, totalValue = 0, label = 'Export', compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<Format | null>(null);

  async function handleExport(fmt: Format) {
    setExporting(fmt);
    setOpen(false);
    const date = new Date().toISOString().slice(0, 10);
    try {
      if (fmt === 'csv')  exportCSV(holdings, `sova-portfolio-${date}.csv`);
      if (fmt === 'xlsx') await exportXLSX(holdings, `sova-portfolio-${date}.xlsx`);
      if (fmt === 'pdf')  await exportPDF(holdings, totalValue, `sova-portfolio-${date}.pdf`);
    } catch (e) {
      console.error('Export failed', e);
    }
    setExporting(null);
  }

  const formats: { fmt: Format; label: string; icon: string; color: string }[] = [
    { fmt: 'csv',  label: 'CSV',  icon: 'table_view',         color: '#4edea3' },
    { fmt: 'xlsx', label: 'Excel (.xlsx)', icon: 'grid_on',   color: '#adc6ff' },
    { fmt: 'pdf',  label: 'PDF Report',   icon: 'picture_as_pdf', color: '#D4AF37' },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        disabled={holdings.length === 0 || exporting !== null}
        className={cn(
          'flex items-center gap-2 rounded-lg transition-all disabled:opacity-50',
          compact
            ? 'px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#8c909f] hover:text-[#dde2f8]'
            : 'px-5 py-2.5 text-[10px] font-black uppercase tracking-widest',
        )}
        style={compact ? { background: '#1a2035', border: '1px solid #2f3445' } : {
          background: '#1a2035',
          border: '1px solid #2f3445',
        }}
      >
        {exporting
          ? <span className="material-symbols-outlined text-sm animate-spin" style={{ animationDuration: '0.8s' }}>progress_activity</span>
          : <span className="material-symbols-outlined text-sm">download</span>
        }
        <span className="text-[#dde2f8]">{exporting ? `Exporting ${exporting.toUpperCase()}…` : label}</span>
        {!exporting && <span className="material-symbols-outlined text-xs text-[#8c909f]">expand_more</span>}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[50]" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden z-[51] shadow-[0_16px_40px_-8px_rgba(0,0,0,0.7)]"
              style={{ background: '#141c30', border: '1px solid #2f3445' }}
            >
              {formats.map(({ fmt, label: fLabel, icon, color }, i) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1e2a42] transition-colors',
                    i > 0 && 'border-t border-[#2f3445]/50',
                  )}
                >
                  <span className="material-symbols-outlined text-base" style={{ color }}>{icon}</span>
                  <span className="text-[11px] font-black text-[#dde2f8]">{fLabel}</span>
                </button>
              ))}
              <div className="px-4 py-2 border-t border-[#2f3445]/50">
                <p className="text-[9px] text-[#424754] font-semibold">{holdings.length} positions · live data</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
