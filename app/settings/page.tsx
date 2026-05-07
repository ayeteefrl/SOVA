'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { cn } from '@/lib/utils';
import { useSettings, type ThemeId } from '@/components/SettingsContext';

function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch { /* silent */ }
    router.push('/login');
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

/* ── Integrations Panel ──────────────────────────────────────────── */
function IntegrationsPanel() {
  const [kiteStatus, setKiteStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [connecting, setConnecting] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

  useEffect(() => {
    fetch('/api/auth/kite/status')
      .then((r) => r.json())
      .then((d) => setKiteStatus(d.authenticated ? 'connected' : 'disconnected'))
      .catch(() => setKiteStatus('disconnected'));
  }, []);

  function handleConnect() {
    setConnecting(true);
    window.location.href = '/api/auth/kite/login';
  }

  const isConnected = kiteStatus === 'connected';
  const statusColor = isConnected ? '#4edea3' : kiteStatus === 'loading' ? '#D4AF37' : '#8c909f';
  const statusLabel = kiteStatus === 'loading' ? 'Checking…' : isConnected ? 'Connected' : 'Not Connected';

  const mainBrokers = [
    { name: 'Groww', category: 'Broker · Stocks & MF' },
    { name: 'Angel One', category: 'Broker · Full-Service' },
    { name: 'Upstox', category: 'Broker · Discount' },
  ];

  const otherBrokers = [
    { name: 'HDFC Securities', category: 'Broker · Bank-Backed' },
    { name: 'ICICI Direct', category: 'Broker · Bank-Backed' },
    { name: 'Motilal Oswal', category: 'Broker · Full-Service' },
    { name: 'Kotak Securities', category: 'Broker · Bank-Backed' },
    { name: 'CAMS', category: 'MF Registrar' },
    { name: 'ClearTax', category: 'Tax Platform' },
  ];

  return (
    <Card tier="low" className="p-8">
      <SectionHeader title="Integrations" subtitle="Brokers and financial platforms" className="mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Zerodha — live, functional */}
        <div className="p-5 rounded-xl bg-surface-container-highest/20 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-black text-on-surface">Zerodha Kite</p>
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">Broker · Live Data</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[10px] text-outline leading-relaxed">
            {isConnected
              ? 'Live holdings, trades, and portfolio data streaming from your Zerodha account.'
              : 'Connect your Zerodha account for live portfolio data, holdings, and trade history.'}
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting || kiteStatus === 'loading'}
            className={cn(
              'w-full h-10 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all',
              isConnected
                ? 'bg-surface-container-highest/40 text-on-surface hover:bg-surface-container-highest/60'
                : 'gradient-primary text-on-primary-container shadow-glow hover:scale-[1.01]',
              (connecting || kiteStatus === 'loading') && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className="material-symbols-outlined text-sm">
              {connecting ? 'hourglass_empty' : isConnected ? 'sync' : 'link'}
            </span>
            {connecting ? 'Redirecting…' : isConnected ? 'Reconnect Zerodha' : 'Connect Zerodha'}
          </button>
        </div>

        {/* Main brokers — coming soon */}
        {mainBrokers.map((b) => (
          <div key={b.name} className="p-5 rounded-xl bg-surface-container-highest/20 flex items-center justify-between opacity-60">
            <div>
              <p className="text-sm font-black text-on-surface">{b.name}</p>
              <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">{b.category}</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-outline/10 text-outline">
              Coming Soon
            </span>
          </div>
        ))}

        {/* Others button */}
        <div className="col-span-full">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-outline hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-sm">{showOthers ? 'expand_less' : 'expand_more'}</span>
            {showOthers ? 'Hide' : 'Show'} Other Brokers &amp; Platforms
          </button>
        </div>

        <AnimatePresence>
          {showOthers && otherBrokers.map((b, i) => (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: i * 0.04 }}
              className="p-5 rounded-xl bg-surface-container-highest/10 flex items-center justify-between opacity-50"
            >
              <div>
                <p className="text-sm font-black text-on-surface">{b.name}</p>
                <p className="text-[10px] text-outline font-bold uppercase tracking-widest mt-0.5">{b.category}</p>
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-outline/10 text-outline">
                Coming Soon
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Card>
  );
}

/* ── Security Panel ──────────────────────────────────────────────── */
function SecurityPanel() {
  const [sessions, setSessions] = useState<{
    id: string; device_name: string; browser: string; ip_address: string;
    last_active: string; is_current?: boolean;
  }[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

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
          <button className="px-5 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest bg-surface-container-highest/40 text-outline hover:text-on-surface transition-colors">
            Change Password
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ── Main Settings Page ──────────────────────────────────────────── */
export default function SettingsPage() {
  const [active, setActive] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { theme, setTheme, avatarUrl, setAvatar, prefs, setPrefs, savePrefs } = useSettings();

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
    <div className="p-8 space-y-8 pb-16">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">

        {/* Side nav */}
        <Card tier="low" className="p-4 h-fit sticky top-4">
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

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
