'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { cn } from '@/lib/utils';
import { useSettings, type ThemeId } from '@/components/SettingsContext';
import { ExportPortfolio } from '@/components/ExportPortfolio';
import { ImportModal } from '@/components/ImportModal';
import { useHoldings } from '@/components/HoldingsContext';

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* silent */ }
    router.push('/sign-in');
  }

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all text-[#ff4444] hover:bg-[#ff4444]/10 disabled:opacity-50"
    >
      <span className="material-symbols-outlined text-sm">logout</span>
      {loading ? 'Logging out…' : 'Log Out'}
    </button>
  );
}

const sections = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
  { id: 'security', label: 'Security', icon: 'security' },
  { id: 'integrations', label: 'Integrations', icon: 'extension' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'data', label: 'Import / Export', icon: 'import_export' },
];

const CURRENCIES = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar' },
];

type Theme = { id: ThemeId; name: string; gradient: string; bg: string; accent: string };
const THEMES: Theme[] = [
  { id: 'obsidian', name: 'Obsidian', gradient: 'from-[#0d1322] to-[#080e1d]', bg: '#0d1322', accent: '#adc6ff' },
  { id: 'midnight', name: 'Midnight Blue', gradient: 'from-[#0a1628] to-[#050d1a]', bg: '#0a1628', accent: '#6eb0ff' },
  { id: 'slate', name: 'Slate', gradient: 'from-[#1a1f2e] to-[#0f141f]', bg: '#1a1f2e', accent: '#adc6ff' },
  { id: 'royal', name: 'Royal Purple', gradient: 'from-[#12102a] to-[#0a0818]', bg: '#12102a', accent: '#c4b5fd' },
  { id: 'noir', name: 'Carbon Noir', gradient: 'from-[#111111] to-[#050505]', bg: '#111', accent: '#e2e8f0' },
];

/* ── Color Picker Field ──────────────────────────────────────────── */
function ColorPickerField({
  label, value, onChange, presets, preview,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
  presets: string[];
  preview: React.ReactNode;
}) {
  const [hex, setHex] = useState(value);

  useEffect(() => { setHex(value); }, [value]);

  function handleHexBlur() {
    const clean = hex.startsWith('#') ? hex : `#${hex}`;
    if (/^#[0-9a-fA-F]{6}$/.test(clean)) {
      onChange(clean);
      setHex(clean);
    } else {
      setHex(value); // revert on invalid
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-[9px] font-black uppercase tracking-widest text-outline">{label}</label>

      {/* Big swatch + color input */}
      <div className="flex items-stretch gap-3">
        <label className="relative w-14 h-14 rounded-xl overflow-hidden cursor-pointer ring-1 ring-outline-variant/20 hover:ring-primary/40 transition-all shrink-0">
          <div className="absolute inset-0" style={{ backgroundColor: value }} />
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setHex(e.target.value); }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>
        <div className="flex-1 space-y-1.5">
          <div className="relative flex items-center bg-surface-container-highest/40 rounded-lg ring-1 ring-outline-variant/20 focus-within:ring-primary/40 transition-all overflow-hidden">
            <span className="pl-3 text-[11px] font-mono text-outline select-none">#</span>
            <input
              type="text"
              value={hex.replace(/^#/, '')}
              onChange={(e) => setHex(`#${e.target.value}`)}
              onBlur={handleHexBlur}
              onKeyDown={(e) => { if (e.key === 'Enter') handleHexBlur(); }}
              maxLength={6}
              className="flex-1 bg-transparent px-1 py-2 text-[11px] font-mono text-on-surface outline-none uppercase"
              placeholder="4edea3"
            />
          </div>
          <div className="preview-text">{preview}</div>
        </div>
      </div>

      {/* Preset swatches */}
      <div className="flex gap-2 flex-wrap">
        {presets.map((c) => (
          <button
            key={c}
            onClick={() => { onChange(c); setHex(c); }}
            title={c}
            className="w-7 h-7 rounded-lg ring-1 ring-outline-variant/20 hover:scale-110 transition-all"
            style={{
              backgroundColor: c,
              boxShadow: value === c ? `0 0 0 2px #fff3, 0 0 8px ${c}80` : undefined,
              outline: value === c ? `2px solid ${c}` : undefined,
              outlineOffset: value === c ? '2px' : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Remove broker-sourced entries from localStorage, keep custom holdings
function clearBrokerCache(broker: 'zerodha' | 'angel_one') {
  try {
    for (const key of ['sova-equity-holdings', 'sova-mf-holdings', 'sova-etf-holdings']) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const arr = JSON.parse(raw) as Array<{ source?: string }>;
      const kept = arr.filter((h) => h.source !== broker);
      if (kept.length === 0) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(kept));
    }
  } catch {}
}

/* ── Shared broker status helpers ───────────────────────────────── */
type BrokerStatus = 'loading' | 'connected' | 'disconnected';

function statusColor(s: BrokerStatus) {
  return s === 'connected' ? '#4edea3' : s === 'loading' ? '#D4AF37' : '#8c909f';
}
function statusLabel(s: BrokerStatus) {
  return s === 'loading' ? 'Checking…' : s === 'connected' ? 'Connected' : 'Not Connected';
}

/* ── Credential modal (for non-OAuth brokers) ────────────────────── */
interface CredField { key: string; label: string; type?: string; placeholder?: string; hint?: string }
function CredentialModal({
  title, category, fields, endpoint, onSuccess, onClose,
}: {
  title: string; category: string; fields: CredField[];
  endpoint: string; onSuccess: () => void; onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Connection failed'); setLoading(false); return; }
      onSuccess();
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/80 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.4)' }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#adc6ff30] to-transparent" />
        <div className="p-7">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-sm font-black text-[#dde2f8]">Connect {title}</p>
              <p className="text-[10px] text-[#8c909f] font-bold uppercase tracking-widest mt-0.5">{category}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8c909f] hover:text-[#dde2f8] transition-colors">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">{f.label}</label>
                <input
                  type={f.type ?? 'text'}
                  placeholder={f.placeholder}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  required
                  className="w-full h-11 px-4 rounded-xl text-sm font-bold text-[#dde2f8] placeholder-[#424754] outline-none focus:ring-1 focus:ring-[#4d8eff]/60"
                  style={{ background: '#1a2035', border: '1px solid #2f3445' }}
                />
                {f.hint && <p className="text-[9px] text-[#424754]">{f.hint}</p>}
              </div>
            ))}
            {error && (
              <div className="p-3 rounded-xl bg-[#ffb2b7]/10 border border-[#ffb2b7]/20">
                <p className="text-[11px] text-[#ffb2b7] font-semibold">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-40 transition-all hover:scale-[1.01]"
              style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 20px rgba(173,198,255,0.2)' }}
            >
              <span className="material-symbols-outlined text-sm">{loading ? 'hourglass_empty' : 'link'}</span>
              {loading ? 'Connecting…' : `Connect ${title}`}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Single broker card ──────────────────────────────────────────── */
function BrokerCard({
  name, category, description, status, onConnect, onDisconnect, connecting, disconnecting,
}: {
  name: string; category: string; description: string; status: BrokerStatus;
  onConnect: () => void; onDisconnect: () => void;
  connecting?: boolean; disconnecting?: boolean;
}) {
  const color = statusColor(status);
  const isConnected = status === 'connected';
  return (
    <div className="p-5 rounded-xl bg-surface-container-highest/20 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-black text-on-surface">{name}</p>
          <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">{category}</p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ backgroundColor: `${color}15`, color }}>
          {statusLabel(status)}
        </span>
      </div>
      <p className="text-[10px] text-outline leading-relaxed">{description}</p>
      <button
        onClick={onConnect}
        disabled={connecting || status === 'loading'}
        className={cn(
          'w-full h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all',
          isConnected
            ? 'bg-surface-container-highest/40 text-on-surface hover:bg-surface-container-highest/60'
            : 'gradient-primary text-on-primary-container shadow-glow hover:scale-[1.01]',
          (connecting || status === 'loading') && 'opacity-50 cursor-not-allowed',
        )}
      >
        <span className="material-symbols-outlined text-sm">
          {connecting ? 'hourglass_empty' : isConnected ? 'sync' : 'link'}
        </span>
        {connecting ? 'Connecting…' : isConnected ? `Reconnect ${name}` : `Connect ${name}`}
      </button>
      {isConnected && (
        <button
          onClick={onDisconnect}
          disabled={disconnecting}
          className="w-full h-8 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all hover:bg-[#ff4444]/10 disabled:opacity-40"
          style={{ color: '#ff6666', border: '1px solid rgba(255,68,68,0.2)' }}
        >
          <span className="material-symbols-outlined text-xs">
            {disconnecting ? 'hourglass_empty' : 'link_off'}
          </span>
          {disconnecting ? 'Disconnecting…' : `Disconnect ${name}`}
        </button>
      )}
    </div>
  );
}

/* ── CAMS PDF upload card ─────────────────────────────────────────── */
function CAMSCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [result, setResult] = useState('');
  const [password, setPassword] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setStatus('uploading');
    setResult('');
    const form = new FormData();
    form.append('file', file);
    if (password.trim()) form.append('password', password.trim());
    try {
      const res = await fetch('/api/cams/parse', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) { setStatus('error'); setResult(data.error ?? 'Parse failed'); return; }
      setStatus('done');
      setResult(`${data.imported} mutual fund holdings imported${data.investorName ? ` for ${data.investorName}` : ''}.`);
      window.dispatchEvent(new Event('sova:refresh'));
    } catch {
      setStatus('error');
      setResult('Upload failed. Please try again.');
    }
  }

  return (
    <div className="p-5 rounded-xl bg-surface-container-highest/20 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-black text-on-surface">CAMS</p>
          <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">MF Registrar · CAS Import</p>
        </div>
        <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
          style={{ backgroundColor: status === 'done' ? '#4edea315' : '#8c909f15', color: status === 'done' ? '#4edea3' : '#8c909f' }}>
          {status === 'done' ? 'Imported' : status === 'uploading' ? 'Parsing…' : 'PDF Upload'}
        </span>
      </div>
      <p className="text-[10px] text-outline leading-relaxed">
        Import all your mutual fund holdings by uploading your Consolidated Account Statement (CAS) PDF.
      </p>

      {/* Step 1 — download */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-outline/70">Step 1 — Download your CAS</p>
        <a
          href="https://www.mfcentral.com"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-9 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
          style={{ background: 'rgba(173,198,255,0.08)', border: '1px solid rgba(173,198,255,0.2)', color: '#adc6ff' }}
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          Open MFCentral → Statements → CAS
        </a>
      </div>

      {/* Step 2 — enter PAN */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-outline/70">Step 2 — Enter your PAN</p>
        <p className="text-[9px] text-outline/60">CAMS PDFs are password-protected with your PAN (e.g. ABCDE1234F)</p>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value.toUpperCase())}
          placeholder="Your PAN — e.g. ABCDE1234F"
          maxLength={10}
          className="w-full h-9 px-3 rounded-lg bg-surface-container-low border border-outline-variant/40 text-[11px] text-on-surface placeholder:text-outline/40 focus:outline-none focus:border-primary/60 transition-colors font-mono uppercase tracking-widest"
        />
      </div>

      {/* Step 3 — upload */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[9px] font-black uppercase tracking-widest text-outline/70">Step 3 — Upload the PDF</p>
        {result && (
          <p className={cn('text-[10px] font-semibold', status === 'error' ? 'text-[#ffb2b7]' : 'text-[#4edea3]')}>{result}</p>
        )}
        <button
          onClick={() => fileRef.current?.click()}
          disabled={status === 'uploading' || !password.trim()}
          className="w-full h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 gradient-primary text-on-primary-container shadow-glow hover:scale-[1.01] transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-sm">
            {status === 'uploading' ? 'hourglass_empty' : 'upload_file'}
          </span>
          {status === 'uploading' ? 'Parsing PDF…' : 'Upload CAS PDF'}
        </button>
        {!password.trim() && (
          <p className="text-[9px] text-outline/50 text-center">Enter your PAN above before uploading</p>
        )}
      </div>
      <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ── Integrations Panel ──────────────────────────────────────────── */
function IntegrationsPanel() {
  const { refresh } = useHoldings();

  // OAuth brokers
  const [kiteStatus, setKiteStatus] = useState<BrokerStatus>('loading');
  const [angelStatus, setAngelStatus] = useState<BrokerStatus>('loading');
  const [upstoxStatus, setUpstoxStatus] = useState<BrokerStatus>('loading');
  const [hdfcStatus, setHdfcStatus] = useState<BrokerStatus>('loading');
  const [connectingKite, setConnectingKite] = useState(false);
  const [connectingAngel, setConnectingAngel] = useState(false);
  const [connectingUpstox, setConnectingUpstox] = useState(false);
  const [connectingHdfc, setConnectingHdfc] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Credential-modal brokers
  const [growwStatus, setGrowwStatus] = useState<BrokerStatus>('loading');
  const [motilaStatus, setMotilaStatus] = useState<BrokerStatus>('loading');
  const [modal, setModal] = useState<'groww' | 'motilal' | null>(null);

  useEffect(() => {
    const check = (url: string, setter: (s: BrokerStatus) => void) =>
      fetch(url).then((r) => r.json())
        .then((d) => setter(d.connected || d.authenticated ? 'connected' : 'disconnected'))
        .catch(() => setter('disconnected'));

    check('/api/auth/kite/status', setKiteStatus);
    check('/api/auth/angel/status', setAngelStatus);
    check('/api/upstox/status', setUpstoxStatus);
    check('/api/hdfc/status', setHdfcStatus);
    check('/api/groww/status', setGrowwStatus);
    check('/api/motilal/status', setMotilaStatus);

    // Reset any stuck "connecting" spinners when user navigates back to this page
    const resetConnecting = () => {
      setConnectingKite(false);
      setConnectingAngel(false);
      setConnectingUpstox(false);
      setConnectingHdfc(false);
    };
    window.addEventListener('pageshow', resetConnecting);
    return () => window.removeEventListener('pageshow', resetConnecting);
  }, []);

  async function handleDisconnect(broker: string, url: string, cacheKey?: string) {
    setDisconnecting(broker);
    try {
      await fetch(url, { method: 'POST' });
      if (cacheKey) clearBrokerCache(cacheKey as 'zerodha' | 'angel_one');
      if (broker === 'zerodha') setKiteStatus('disconnected');
      else if (broker === 'angel') setAngelStatus('disconnected');
      else if (broker === 'upstox') setUpstoxStatus('disconnected');
      else if (broker === 'hdfc') setHdfcStatus('disconnected');
      else if (broker === 'groww') setGrowwStatus('disconnected');
      else if (broker === 'motilal') setMotilaStatus('disconnected');
      refresh();
    } catch {}
    setDisconnecting(null);
  }

  const comingSoon = [
    { name: 'ICICI Direct', category: 'Broker · Bank-Backed' },
    { name: 'Kotak Securities', category: 'Broker · Bank-Backed' },
    { name: 'ClearTax', category: 'Tax Platform' },
  ];

  return (
    <Card tier="low" className="p-8">
      <SectionHeader title="Integrations" subtitle="Brokers and financial platforms" className="mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <BrokerCard
          name="Zerodha Kite" category="Broker · Live Data"
          description={kiteStatus === 'connected' ? 'Live holdings, trades, and portfolio data streaming from your Zerodha account.' : 'Connect your Zerodha account for live portfolio data, holdings, and trade history.'}
          status={kiteStatus}
          connecting={connectingKite} disconnecting={disconnecting === 'zerodha'}
          onConnect={() => { setConnectingKite(true); window.location.href = '/api/auth/kite/login'; }}
          onDisconnect={() => handleDisconnect('zerodha', '/api/auth/kite/disconnect', 'zerodha')}
        />

        <BrokerCard
          name="Angel One" category="Broker · Full-Service"
          description={angelStatus === 'connected' ? 'Live holdings and portfolio data streaming from your Angel One account.' : 'Connect your Angel One account for live portfolio data and trade history.'}
          status={angelStatus}
          connecting={connectingAngel} disconnecting={disconnecting === 'angel'}
          onConnect={() => { setConnectingAngel(true); window.location.href = '/api/auth/angel/login'; }}
          onDisconnect={() => handleDisconnect('angel', '/api/auth/angel/disconnect', 'angel_one')}
        />

        <BrokerCard
          name="Upstox" category="Broker · Discount"
          description={upstoxStatus === 'connected' ? 'Live equity holdings and positions from your Upstox account.' : 'Connect your Upstox account for live holdings and mutual fund data.'}
          status={upstoxStatus}
          connecting={connectingUpstox} disconnecting={disconnecting === 'upstox'}
          onConnect={() => { setConnectingUpstox(true); window.location.href = '/api/upstox/auth'; }}
          onDisconnect={() => handleDisconnect('upstox', '/api/upstox/disconnect')}
        />

        <BrokerCard
          name="Groww" category="Broker · Stocks & MF"
          description={growwStatus === 'connected' ? 'Live equity holdings from your Groww account.' : 'Connect with your Groww authenticator TOTP to load live holdings.'}
          status={growwStatus}
          disconnecting={disconnecting === 'groww'}
          onConnect={() => setModal('groww')}
          onDisconnect={() => handleDisconnect('groww', '/api/groww/disconnect')}
        />

        <BrokerCard
          name="HDFC Securities" category="Broker · Bank-Backed"
          description={hdfcStatus === 'connected' ? 'Live holdings from your HDFC Securities InvestRight account.' : 'Connect your HDFC Securities account via the InvestRight developer portal.'}
          status={hdfcStatus}
          connecting={connectingHdfc} disconnecting={disconnecting === 'hdfc'}
          onConnect={() => { setConnectingHdfc(true); window.location.href = '/api/hdfc/login'; }}
          onDisconnect={() => handleDisconnect('hdfc', '/api/hdfc/disconnect')}
        />

        <BrokerCard
          name="Motilal Oswal" category="Broker · Full-Service"
          description={motilaStatus === 'connected' ? 'Live holdings from your Motilal Oswal moAPI account. Token refreshes daily.' : 'Connect with your moAPI password and TOTP. Token expires at 6 AM IST daily.'}
          status={motilaStatus}
          disconnecting={disconnecting === 'motilal'}
          onConnect={() => setModal('motilal')}
          onDisconnect={() => handleDisconnect('motilal', '/api/motilal/disconnect')}
        />

        <CAMSCard />

        {comingSoon.map((b) => (
          <div key={b.name} className="p-5 rounded-xl bg-surface-container-highest/20 flex items-center justify-between opacity-50">
            <div>
              <p className="text-sm font-black text-on-surface">{b.name}</p>
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">{b.category}</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-outline/10 text-outline">
              Coming Soon
            </span>
          </div>
        ))}
      </div>

      {/* Credential modals */}
      <AnimatePresence>
        {modal === 'groww' && (
          <CredentialModal
            title="Groww" category="Broker · Stocks & MF"
            endpoint="/api/groww/connect"
            fields={[
              { key: 'totp', label: 'TOTP (6-digit)', placeholder: '123456', type: 'text', hint: 'From the authenticator app linked to your Groww trading account' },
            ]}
            onSuccess={() => { setModal(null); setGrowwStatus('connected'); refresh(); }}
            onClose={() => setModal(null)}
          />
        )}
        {modal === 'motilal' && (
          <CredentialModal
            title="Motilal Oswal" category="Broker · Full-Service"
            endpoint="/api/motilal/connect"
            fields={[
              { key: 'password', label: 'Trading Password', placeholder: 'Your moAPI login password', type: 'password' },
              { key: 'totp', label: 'TOTP (6-digit)', placeholder: '123456', hint: 'From your linked authenticator app. Token expires at 6 AM IST daily.' },
            ]}
            onSuccess={() => { setModal(null); setMotilaStatus('connected'); refresh(); }}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

/* ── Delete Account Modal ────────────────────────────────────────── */
function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [confirm1, setConfirm1] = useState('');
  const [confirm2, setConfirm2] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const PHRASE1 = 'DELETE MY ACCOUNT';
  const PHRASE2 = 'I UNDERSTAND THIS IS PERMANENT';

  const isValid = confirm1 === PHRASE1 && confirm2 === PHRASE2;

  async function handleDelete() {
    if (!isValid) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/auth/delete-account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete account');
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/sign-in');
    } catch {
      setError('Something went wrong. Please contact support.');
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#080e1d]/80 backdrop-blur-xl" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-[0_32px_80px_-12px_rgba(0,0,0,0.9)]"
        style={{ background: '#0f1526', border: '1px solid rgba(255,77,77,0.25)' }}
      >
        {/* Red top accent */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff4444]/60 to-transparent" />

        <div className="p-7">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#ff4444]/15 flex items-center justify-center shrink-0 ring-1 ring-[#ff4444]/30">
              <span className="material-symbols-outlined text-[#ff4444] text-base">warning</span>
            </div>
            <div>
              <p className="text-sm font-black text-[#ff6666]">Delete Account</p>
              <p className="text-[11px] text-[#ff4444]/70 font-semibold mt-0.5">This action is permanent and cannot be undone</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:text-on-surface transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* Warning block */}
          <div className="p-4 rounded-xl bg-[#ff4444]/8 ring-1 ring-[#ff4444]/20 mb-6 space-y-2">
            <p className="text-[11px] text-[#ff8888] font-bold leading-relaxed">
              Deleting your account will permanently remove:
            </p>
            <ul className="space-y-1">
              {['Your profile and credentials', 'All portfolio holdings and trade history', 'Settings, preferences, and integrations', 'All data associated with this account'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-[10px] text-[#ff8888]/80 font-semibold">
                  <span className="material-symbols-outlined text-xs text-[#ff4444]">remove_circle</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Confirmation inputs */}
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff4444]/80 mb-1.5">
                Type exactly: <span className="text-[#ff6666]">&quot;{PHRASE1}&quot;</span>
              </label>
              <input
                type="text"
                value={confirm1}
                onChange={(e) => setConfirm1(e.target.value)}
                placeholder={PHRASE1}
                className="w-full rounded-lg px-4 py-2.5 text-sm placeholder:text-outline/30 focus:outline-none focus:ring-1 transition-all"
                style={{
                  background: '#1a2035',
                  border: `1px solid ${confirm1 === PHRASE1 ? '#ff4444' : '#2f3445'}`,
                  color: confirm1 === PHRASE1 ? '#ff6666' : '#dde2f8',
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff4444]/80 mb-1.5">
                Type exactly: <span className="text-[#ff6666]">&quot;{PHRASE2}&quot;</span>
              </label>
              <input
                type="text"
                value={confirm2}
                onChange={(e) => setConfirm2(e.target.value)}
                placeholder={PHRASE2}
                className="w-full rounded-lg px-4 py-2.5 text-sm placeholder:text-outline/30 focus:outline-none focus:ring-1 transition-all"
                style={{
                  background: '#1a2035',
                  border: `1px solid ${confirm2 === PHRASE2 ? '#ff4444' : '#2f3445'}`,
                  color: confirm2 === PHRASE2 ? '#ff6666' : '#dde2f8',
                }}
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-[#ff6666] font-semibold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">error</span>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
              style={{ background: '#1e2538', border: '1px solid #2f3445' }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={!isValid || deleting}
              className="flex-1 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: isValid ? '#ff2222' : '#3a1a1a',
                color: isValid ? '#fff' : '#ff4444',
                boxShadow: isValid ? '0 0 20px rgba(255,34,34,0.35)' : 'none',
              }}
            >
              {deleting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">delete_forever</span>
                  Delete Forever
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Change Password Modal ───────────────────────────────────────── */
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (next.length < 8) { setError('New password must be at least 8 characters.'); return; }
    if (next !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to change password.'); return; }
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  const fieldStyle = { background: '#1a2035', border: '1px solid #2f3445' };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-8 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.85)]"
        style={{ background: '#0f1526', border: '1px solid rgba(66,71,84,0.5)' }}
      >
        {success ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
            <p className="text-sm font-black text-on-surface">Password changed</p>
            <p className="text-[11px] text-outline">All other sessions will be revoked.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-black text-on-surface">Change Password</h2>
                <p className="text-[11px] text-outline mt-0.5">Revokes all other active sessions.</p>
              </div>
              <button onClick={onClose} className="text-outline hover:text-on-surface transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {[
                { label: 'Current Password', val: current, set: setCurrent },
                { label: 'New Password',     val: next,    set: setNext },
                { label: 'Confirm Password', val: confirm, set: setConfirm },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1.5">{label}</label>
                  <div className="flex items-center gap-2 rounded-lg px-3" style={fieldStyle}>
                    <span className="material-symbols-outlined text-sm text-outline shrink-0">lock</span>
                    <input
                      type={show ? 'text' : 'password'}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      required
                      disabled={loading}
                      placeholder="••••••••"
                      className="flex-1 bg-transparent py-3 text-sm text-on-surface placeholder:text-outline/40 outline-none"
                    />
                    {label === 'Confirm Password' && (
                      <button type="button" onClick={() => setShow((v) => !v)} className="text-outline hover:text-on-surface transition-colors shrink-0">
                        <span className="material-symbols-outlined text-sm">{show ? 'visibility_off' : 'visibility'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tertiary/10 ring-1 ring-tertiary/25">
                  <span className="material-symbols-outlined text-sm text-tertiary shrink-0">error</span>
                  <p className="text-[11px] text-tertiary font-semibold">{error}</p>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-60 hover:scale-[1.01] mt-2"
                style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 24px rgba(173,198,255,0.2)' }}
              >
                {loading ? <><span className="w-4 h-4 rounded-full border-2 border-[#001a42]/30 border-t-[#001a42] animate-spin" />Saving…</> : <><span className="material-symbols-outlined text-sm">lock_reset</span>Update Password</>}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}

/* ── Security Panel ──────────────────────────────────────────────── */
function SecurityPanel() {
  const [sessions, setSessions] = useState<{
    id: string; device_name: string; browser: string; ip_address: string;
    last_active: string; is_current?: boolean;
  }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    fetch('/api/sessions')
      .then((r) => r.ok ? r.json() : [])
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoadingSessions(false));
  }, []);

  async function revokeSession(id: string) {
    await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <>
      <Card tier="low" className="p-8">
        <SectionHeader title="Security" subtitle="Active sessions and access control" className="mb-6" />
        <div className="space-y-6">
          <div className="p-5 rounded-lg bg-surface-container-highest/20">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-black text-on-surface">Active Sessions</p>
              <p className="text-[9px] font-bold text-outline uppercase tracking-widest">
                {sessions.length} session{sessions.length !== 1 ? 's' : ''}
              </p>
            </div>
            {loadingSessions ? (
              <div className="text-center py-4">
                <span className="material-symbols-outlined text-xl text-outline animate-spin">sync</span>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-[11px] text-outline py-4 text-center">
                No session data yet — log in again to start tracking.
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => (
                  <div key={s.id} className={cn(
                    'flex justify-between items-center py-3 px-3 rounded-lg',
                    s.is_current ? 'bg-primary/8 ring-1 ring-primary/20' : 'hover:bg-surface-container-highest/20',
                  )}>
                    <div>
                      <p className="text-[11px] font-bold text-on-surface">
                        {s.browser} · {s.device_name}
                        {s.is_current && <span className="ml-2 text-[8px] font-black uppercase tracking-widest text-primary-fixed-dim bg-primary/15 px-2 py-0.5 rounded-full">Current</span>}
                      </p>
                      <p className="text-[9px] text-outline mt-0.5">
                        {s.ip_address} · Last active {new Date(s.last_active).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    {!s.is_current && (
                      <button
                        onClick={() => revokeSession(s.id)}
                        className="text-[9px] font-black uppercase tracking-widest text-tertiary hover:underline transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-lg bg-surface-container-highest/20">
            <p className="text-sm font-black text-on-surface mb-1">Change Password</p>
            <p className="text-[10px] text-outline mb-3">Changing your password will revoke all other sessions.</p>
            <button
              onClick={() => setShowChangePassword(true)}
              className="px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/40 text-outline hover:text-on-surface transition-colors"
            >
              Change Password
            </button>
          </div>

          {/* Danger Zone */}
          <div className="p-5 rounded-lg ring-1 ring-[#ff4444]/20 bg-[#ff2222]/5">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-sm text-[#ff4444]">dangerous</span>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#ff4444]">Danger Zone</p>
            </div>
            <p className="text-sm font-black text-[#ff6666] mb-1">Delete Account</p>
            <p className="text-[11px] text-[#ff8888]/70 font-semibold mb-4 leading-relaxed">
              Permanently deletes your SOVA account, all portfolio data, holdings, and trade history.
              This action cannot be reversed.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all hover:scale-[1.01]"
              style={{ background: '#2a0a0a', border: '1px solid #ff4444', color: '#ff4444' }}
            >
              <span className="material-symbols-outlined text-sm">delete_forever</span>
              Delete My Account
            </button>
          </div>
        </div>
      </Card>

      <AnimatePresence>
        {showDeleteModal && (
          <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showChangePassword && (
          <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
        )}
      </AnimatePresence>
    </>
  );
}

/* ── Main Settings Page ──────────────────────────────────────────── */
export default function SettingsPage() {
  const [active, setActive] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showImport, setShowImport] = useState(false);

  const { theme, setTheme, avatarUrl, setAvatar, prefs, setPrefs, savePrefs } = useSettings();
  const { equityHoldings, mutualFundHoldings, etfHoldings } = useHoldings();
  const allHoldings = [...equityHoldings, ...mutualFundHoldings, ...etfHoldings];
  const totalValue = allHoldings.reduce((s, h) => s + h.value, 0);

  // Profile state
  const [profile, setProfile] = useState({ full_name: '', email: '', mobile: '', profile_photo: '' });
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const res = await fetch('/api/profile');
    if (res.ok) {
      const data = await res.json();
      setProfile({
        full_name: data.full_name ?? '',
        email: data.email ?? '',
        mobile: data.mobile ?? '',
        profile_photo: data.profile_photo ?? '',
      });
      if (data.profile_photo) setAvatar(data.profile_photo);
    }
    setProfileLoading(false);
  }, [setAvatar]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Avatar upload
  function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAvatar(dataUrl);
      setProfile((p) => ({ ...p, profile_photo: dataUrl }));
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveProfile() {
    setSaving(true);
    await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: profile.full_name,
        mobile: profile.mobile,
        profile_photo: profile.profile_photo,
      }),
    });
    setSaving(false);
    setSaved(true);
    window.dispatchEvent(new Event('sova:profile-updated'));
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleSavePrefs() {
    setSaving(true);
    await savePrefs(prefs);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : profile.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 pb-16">
      {/* Mobile: horizontal tab strip */}
      <div className="lg:hidden overflow-x-auto scrollbar-none -mx-4 px-4">
        <div className="flex gap-2 pb-1 min-w-max">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => { setActive(s.id); setSaved(false); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-all shrink-0',
                active === s.id
                  ? 'bg-surface-container-highest/60 text-gold ring-1 ring-gold/20'
                  : 'text-outline hover:text-on-surface bg-surface-container-highest/20',
              )}
            >
              <span className="material-symbols-outlined text-xs">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">

        {/* Desktop: side nav */}
        <Card tier="low" className="p-4 h-fit sticky top-4 hidden lg:block">
          {/* SOVA logo */}
          <div className="flex items-center gap-3 px-2 py-3 mb-3 border-b border-outline-variant/10">
            <div className="w-9 h-9 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-full h-full">
                <defs>
                  <linearGradient id="sova-settings-g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#adc6ff" />
                    <stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="6" fill="#0d1322" />
                <path d="M8 22 L8 10 L16 18 L24 10 L24 22" fill="none" stroke="url(#sova-settings-g)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black tracking-tighter gradient-text-primary">SOVA</p>
              <p className="text-[9px] uppercase tracking-widest text-outline font-semibold">Settings</p>
            </div>
          </div>

          <div className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setSaved(false); }}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all',
                  active === s.id
                    ? 'bg-surface-container-highest/50 text-gold'
                    : 'text-outline hover:text-on-surface hover:bg-surface-container-highest/20',
                )}
              >
                <span className="material-symbols-outlined text-sm">{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Logout */}
          <div className="mt-4 pt-4 border-t border-outline-variant/10">
            <LogoutButton />
          </div>
        </Card>

        <div className="space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >

              {/* ── Profile ── */}
              {active === 'profile' && (
                <Card tier="low" className="p-8">
                  <SectionHeader title="Profile" subtitle="Your SOVA account information" className="mb-8" />
                  {profileLoading ? (
                    <div className="text-center py-12"><span className="material-symbols-outlined text-3xl text-outline animate-spin">sync</span></div>
                  ) : (
                    <>
                      <div className="flex items-start gap-6 mb-8">
                        {/* Avatar */}
                        <div className="relative shrink-0 group">
                          <div
                            className="w-24 h-24 rounded-xl overflow-hidden bg-gradient-to-br from-primary-container to-primary/40 flex items-center justify-center text-2xl font-black text-on-primary-container shadow-glow cursor-pointer"
                            onClick={() => fileRef.current?.click()}
                          >
                            {avatarUrl
                              ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                              : <span>{initials}</span>
                            }
                          </div>
                          <button
                            onClick={() => fileRef.current?.click()}
                            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-outline hover:text-primary-fixed-dim transition-colors shadow-elevated"
                          >
                            <span className="material-symbols-outlined text-sm">photo_camera</span>
                          </button>
                          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        </div>

                        {/* Fields */}
                        <div className="flex-1 space-y-3">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1">Full Name</label>
                            <input
                              type="text"
                              value={profile.full_name}
                              onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))}
                              className="w-full bg-surface-container-highest/30 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1">Email</label>
                            <input
                              type="email"
                              value={profile.email}
                              readOnly
                              className="w-full bg-surface-container-highest/20 rounded-lg px-4 py-2.5 text-sm text-outline cursor-not-allowed"
                            />
                            <p className="text-[9px] text-outline mt-0.5">Email cannot be changed</p>
                          </div>
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-widest text-outline mb-1">Mobile</label>
                            <input
                              type="tel"
                              value={profile.mobile}
                              onChange={(e) => setProfile((p) => ({ ...p, mobile: e.target.value }))}
                              placeholder="+91 98765 43210"
                              className="w-full bg-surface-container-highest/30 rounded-lg px-4 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary-container"
                            />
                          </div>
                        </div>
                      </div>
                      {avatarUrl && (
                        <div className="mb-4">
                          <button
                            onClick={() => { setAvatar(null); setProfile((p) => ({ ...p, profile_photo: '' })); }}
                            className="text-[10px] font-bold uppercase tracking-widest text-tertiary hover:underline flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Remove profile picture
                          </button>
                        </div>
                      )}
                      <button
                        onClick={handleSaveProfile}
                        disabled={saving}
                        className="px-6 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-60"
                      >
                        {saving ? (
                          <><span className="material-symbols-outlined text-sm animate-spin">sync</span> Saving…</>
                        ) : saved ? (
                          <><span className="material-symbols-outlined text-sm">check</span> Saved</>
                        ) : (
                          <><span className="material-symbols-outlined text-sm">save</span> Save Changes</>
                        )}
                      </button>
                    </>
                  )}
                </Card>
              )}

              {/* ── Preferences ── */}
              {active === 'preferences' && (
                <Card tier="low" className="p-8">
                  <SectionHeader title="Preferences" subtitle="Terminal display and behaviour" className="mb-6" />

                  {/* Currency */}
                  <div className="mb-6 pb-6 border-b border-outline-variant/10">
                    <p className="text-xs font-bold text-on-surface mb-1">Display Currency</p>
                    <p className="text-[10px] text-outline font-semibold mb-3">All portfolio values shown in selected currency</p>
                    <div className="flex flex-wrap gap-2">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => savePrefs({ currency: c.code })}
                          className={cn(
                            'px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5',
                            prefs.currency === c.code
                              ? 'bg-gold/15 text-gold ring-1 ring-gold/30'
                              : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
                          )}
                        >
                          <span className="text-base leading-none">{c.symbol}</span>
                          {c.code}
                        </button>
                      ))}
                    </div>
                    {prefs.currency !== 'INR' && (
                      <p className="text-[9px] text-gold/70 mt-2">
                        ⚠ Currency conversion uses approximate exchange rates. Add NEXT_PUBLIC_FX_KEY to .env.local for live rates.
                      </p>
                    )}
                  </div>

                  {/* Display format */}
                  <div className="mb-6 pb-6 border-b border-outline-variant/10">
                    <p className="text-xs font-bold text-on-surface mb-3">Display Format</p>
                    <div className="flex gap-2">
                      {[{ id: 'lakh', label: '₹ Lakh / Crore' }, { id: 'million', label: '₹ Million / Billion' }].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => savePrefs({ display_format: f.id })}
                          className={cn(
                            'px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all',
                            prefs.display_format === f.id
                              ? 'bg-primary/15 text-primary-fixed-dim ring-1 ring-primary/30'
                              : 'bg-surface-container-highest/30 text-outline hover:text-on-surface',
                          )}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="divide-y divide-outline-variant/10 mb-6">
                    {[
                      { key: 'live_market_data', label: 'Enable live market data', hint: 'Disabling pauses all live price feeds' },
                      { key: 'compact_view', label: 'Compact view', hint: 'Reduce spacing for denser data display' },
                      { key: 'show_trade_rationale', label: 'Show trade rationale in activity feed', hint: 'Displays reasoning notes on trades' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-4">
                        <div>
                          <p className="text-xs font-bold text-on-surface">{item.label}</p>
                          {item.hint && <p className="text-[10px] text-outline font-semibold mt-0.5">{item.hint}</p>}
                        </div>
                        <button
                          onClick={() => savePrefs({ [item.key]: !prefs[item.key as keyof typeof prefs] })}
                          className={cn('w-11 h-6 rounded-full relative transition-colors',
                            prefs[item.key as keyof typeof prefs] ? 'bg-primary-container' : 'bg-surface-container-highest')}
                        >
                          <motion.span
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className={cn('absolute top-0.5 w-5 h-5 rounded-full',
                              prefs[item.key as keyof typeof prefs] ? 'left-5 bg-primary-fixed' : 'left-0.5 bg-outline-variant')}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Color pickers — polished */}
                  <div className="pt-6 border-t border-outline-variant/10">
                    <p className="text-xs font-bold text-on-surface mb-1">Gain &amp; Loss Colors</p>
                    <p className="text-[10px] text-outline mb-5">Changes apply instantly across the entire terminal</p>

                    <div className="grid grid-cols-2 gap-5">
                      {/* Gain */}
                      <ColorPickerField
                        label="Gain Color"
                        value={prefs.gain_color}
                        onChange={(c) => savePrefs({ gain_color: c })}
                        presets={['#4edea3', '#22c55e', '#10b981', '#34d399', '#6ee7b7', '#86efac']}
                        preview={<span className="text-[11px] font-black" style={{ color: prefs.gain_color }}>▲ +12.4% gain</span>}
                      />
                      {/* Loss */}
                      <ColorPickerField
                        label="Loss Color"
                        value={prefs.loss_color}
                        onChange={(c) => savePrefs({ loss_color: c })}
                        presets={['#ffb2b7', '#f87171', '#ef4444', '#fb7185', '#fca5a5', '#ff6b81']}
                        preview={<span className="text-[11px] font-black" style={{ color: prefs.loss_color }}>▼ −4.8% loss</span>}
                      />
                    </div>

                    <button
                      onClick={() => savePrefs({ gain_color: '#4edea3', loss_color: '#ffb2b7' })}
                      className="mt-4 text-[9px] font-bold text-outline hover:text-on-surface uppercase tracking-widest flex items-center gap-1 transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">restart_alt</span>
                      Reset to defaults
                    </button>
                  </div>

                  <button
                    onClick={handleSavePrefs}
                    disabled={saving}
                    className="mt-8 px-6 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container shadow-glow transition-all flex items-center gap-2 disabled:opacity-60"
                  >
                    {saving ? <><span className="material-symbols-outlined text-sm animate-spin">sync</span> Saving…</> :
                     saved ? <><span className="material-symbols-outlined text-sm">check</span> Saved</> :
                     <><span className="material-symbols-outlined text-sm">save</span> Save Preferences</>}
                  </button>
                </Card>
              )}

              {/* ── Notifications ── */}
              {active === 'notifications' && (
                <Card tier="low" className="p-8">
                  <SectionHeader title="Notifications" subtitle="Alert preferences — saved automatically" className="mb-6" />
                  <div className="divide-y divide-outline-variant/10">
                    {[
                      { key: 'notifications_sip_debit', label: 'SIP execution receipts', hint: 'Alert when a SIP debit is processed' },
                      { key: 'notifications_portfolio', label: 'Portfolio alerts', hint: 'Stop-loss and breakout alerts' },
                      { key: 'notifications_market_hours', label: 'Market open/close reminders', hint: '9:15 AM and 3:30 PM IST' },
                      { key: 'notifications_news_digest', label: 'Weekly digest', hint: 'Sunday 9 AM IST — portfolio news summary' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between py-4">
                        <div>
                          <p className="text-xs font-bold text-on-surface">{item.label}</p>
                          <p className="text-[10px] text-outline font-semibold mt-0.5">{item.hint}</p>
                        </div>
                        <button
                          onClick={() => savePrefs({ [item.key]: !prefs[item.key as keyof typeof prefs] })}
                          className={cn('w-11 h-6 rounded-full relative transition-colors',
                            prefs[item.key as keyof typeof prefs] ? 'bg-primary-container' : 'bg-surface-container-highest')}
                        >
                          <motion.span
                            layout
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className={cn('absolute top-0.5 w-5 h-5 rounded-full',
                              prefs[item.key as keyof typeof prefs] ? 'left-5 bg-primary-fixed' : 'left-0.5 bg-outline-variant')}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-outline mt-4">Changes are saved automatically when you toggle.</p>
                </Card>
              )}

              {/* ── Security ── */}
              {active === 'security' && <SecurityPanel />}

              {/* ── Integrations ── */}
              {active === 'integrations' && <IntegrationsPanel />}

              {/* ── Appearance ── */}
              {active === 'appearance' && (
                <Card tier="low" className="p-8">
                  <SectionHeader title="Appearance" subtitle="Visual theme of the SOVA terminal" className="mb-6" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {THEMES.map((t) => {
                      const isActive = theme === t.id;
                      return (
                        <button key={t.id} onClick={() => setTheme(t.id)}
                          className={cn('p-4 rounded-xl text-left transition-all',
                            isActive ? 'ring-1 ring-gold/50 bg-surface-container-highest/40' : 'hover:bg-surface-container-highest/20')}>
                          <div className={cn('h-20 rounded-lg bg-gradient-to-br mb-3 ghost-border relative overflow-hidden', t.gradient)}>
                            <div className="absolute top-2 left-2 flex gap-1">
                              {['ff5f57', 'febc2e', '28c840'].map((c) => (
                                <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `#${c}` }} />
                              ))}
                            </div>
                            <div className="absolute bottom-2 left-2 right-2 h-1 rounded-full opacity-70" style={{ backgroundColor: t.accent }} />
                          </div>
                          <p className="text-xs font-black text-on-surface">{t.name}</p>
                          {isActive && (
                            <p className="text-[9px] font-bold uppercase tracking-widest text-gold mt-1 flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">check_circle</span>Active
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              {/* ── Import / Export ── */}
              {active === 'data' && (
                <Card tier="low" className="p-8 space-y-8">
                  <SectionHeader title="Import / Export" subtitle="Move portfolio data in and out of SOVA" className="mb-0" />

                  {/* Import */}
                  <div className="p-6 rounded-xl space-y-4" style={{ background: '#141c30', border: '1px solid #2f3445' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#D4AF37/15', border: '1px solid #D4AF37/20', backgroundColor: 'rgba(212,175,55,0.12)' }}>
                        <span className="material-symbols-outlined text-base" style={{ color: '#D4AF37' }}>upload_file</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#dde2f8]">Import Portfolio</p>
                        <p className="text-[10px] text-[#8c909f] mt-0.5">CSV or Excel · auto-logged to Activity Ledger</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#8c909f] leading-relaxed">
                      Upload a CSV or XLSX file with your holdings. Required columns: <span className="text-[#adc6ff] font-semibold">Ticker</span>, <span className="text-[#adc6ff] font-semibold">Units</span>, <span className="text-[#adc6ff] font-semibold">Price</span>. Optional: Name, Action, Date, Sector, Broker, Asset Type.
                    </p>
                    <button
                      onClick={() => setShowImport(true)}
                      className="flex items-center gap-2 px-5 h-10 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.01]"
                      style={{ background: 'linear-gradient(135deg, #4d8eff 0%, #adc6ff 100%)', color: '#001a42', boxShadow: '0 0 16px rgba(173,198,255,0.2)' }}
                    >
                      <span className="material-symbols-outlined text-sm">upload</span>
                      Choose File to Import
                    </button>
                  </div>

                  {/* Export */}
                  <div className="p-6 rounded-xl space-y-4" style={{ background: '#141c30', border: '1px solid #2f3445' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(78,222,163,0.12)', border: '1px solid rgba(78,222,163,0.2)' }}>
                        <span className="material-symbols-outlined text-base" style={{ color: '#4edea3' }}>download</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-[#dde2f8]">Export Portfolio</p>
                        <p className="text-[10px] text-[#8c909f] mt-0.5">{allHoldings.length} positions · CSV, Excel, or PDF</p>
                      </div>
                    </div>
                    <p className="text-xs text-[#8c909f] leading-relaxed">
                      Export your complete portfolio across all asset classes — Equity, Mutual Funds, and ETFs — as a CSV, Excel workbook, or a formatted PDF report.
                    </p>
                    <ExportPortfolio holdings={allHoldings} totalValue={totalValue} label="Export All Holdings" />
                  </div>

                  {/* Equity only */}
                  {equityHoldings.length > 0 && (
                    <div className="p-6 rounded-xl space-y-4" style={{ background: '#141c30', border: '1px solid #2f3445' }}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#8c909f]">Export by Asset Class</p>
                      <div className="flex flex-wrap gap-3">
                        <ExportPortfolio holdings={equityHoldings} totalValue={equityHoldings.reduce((s, h) => s + h.value, 0)} label="Equity Only" compact />
                        {mutualFundHoldings.length > 0 && (
                          <ExportPortfolio holdings={mutualFundHoldings} totalValue={mutualFundHoldings.reduce((s, h) => s + h.value, 0)} label="Mutual Funds" compact />
                        )}
                        {etfHoldings.length > 0 && (
                          <ExportPortfolio holdings={etfHoldings} totalValue={etfHoldings.reduce((s, h) => s + h.value, 0)} label="ETFs" compact />
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        <ImportModal open={showImport} onClose={() => setShowImport(false)} />

        {/* Mobile logout */}
        <div className="lg:hidden pt-2">
          <Card tier="low" className="p-3">
            <LogoutButton />
          </Card>
        </div>
      </div>
    </div>
  );
}
