'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';

export type ThemeId = 'obsidian' | 'midnight' | 'slate' | 'royal' | 'noir';

export interface UserPreferences {
  currency: string;
  display_format: string;
  gain_color: string;
  loss_color: string;
  live_market_data: boolean;
  show_trade_rationale: boolean;
  compact_view: boolean;
  notifications_sip_debit: boolean;
  notifications_portfolio: boolean;
  notifications_market_hours: boolean;
  notifications_news_digest: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  currency: 'INR',
  display_format: 'lakh',
  gain_color: '#4edea3',
  loss_color: '#ffb2b7',
  live_market_data: true,
  show_trade_rationale: true,
  compact_view: false,
  notifications_sip_debit: true,
  notifications_portfolio: true,
  notifications_market_hours: false,
  notifications_news_digest: true,
};

interface SettingsCtxType {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  avatarUrl: string | null;
  setAvatar: (url: string | null) => void;
  prefs: UserPreferences;
  setPrefs: (p: Partial<UserPreferences>) => void;
  savePrefs: (p: Partial<UserPreferences>) => Promise<void>;
}

const SettingsCtx = createContext<SettingsCtxType>({
  theme: 'obsidian',
  setTheme: () => {},
  avatarUrl: null,
  setAvatar: () => {},
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  savePrefs: async () => {},
});

const THEME_VARS: Record<ThemeId, Record<string, string>> = {
  obsidian: {
    '--color-surface': '#0d1322', '--color-surface-lowest': '#080e1d',
    '--color-surface-low': '#151b2b', '--color-surface-mid': '#191f2f',
    '--color-surface-high': '#242a3a', '--color-surface-highest': '#2f3445',
    '--color-primary': '#adc6ff', '--color-primary-container': '#4d8eff',
    '--color-body-bg': '#0d1322',
  },
  midnight: {
    '--color-surface': '#0a1628', '--color-surface-lowest': '#050d1a',
    '--color-surface-low': '#0d1c32', '--color-surface-mid': '#112338',
    '--color-surface-high': '#1a2e46', '--color-surface-highest': '#243a54',
    '--color-primary': '#6eb0ff', '--color-primary-container': '#4090ee',
    '--color-body-bg': '#0a1628',
  },
  slate: {
    '--color-surface': '#1a1f2e', '--color-surface-lowest': '#0f141f',
    '--color-surface-low': '#1d2334', '--color-surface-mid': '#22283a',
    '--color-surface-high': '#2a3147', '--color-surface-highest': '#333c54',
    '--color-primary': '#adc6ff', '--color-primary-container': '#4d8eff',
    '--color-body-bg': '#1a1f2e',
  },
  royal: {
    '--color-surface': '#12102a', '--color-surface-lowest': '#0a0818',
    '--color-surface-low': '#16132f', '--color-surface-mid': '#1a1738',
    '--color-surface-high': '#221f46', '--color-surface-highest': '#2d2a5a',
    '--color-primary': '#c4b5fd', '--color-primary-container': '#7c3aed',
    '--color-body-bg': '#12102a',
  },
  noir: {
    '--color-surface': '#111111', '--color-surface-lowest': '#050505',
    '--color-surface-low': '#151515', '--color-surface-mid': '#1a1a1a',
    '--color-surface-high': '#222222', '--color-surface-highest': '#2e2e2e',
    '--color-primary': '#e2e8f0', '--color-primary-container': '#94a3b8',
    '--color-body-bg': '#111111',
  },
};

function applyTheme(theme: ThemeId) {
  const vars = THEME_VARS[theme];
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.body.style.backgroundColor = vars['--color-body-bg'];
}

function applyGainLossColors(gain: string, loss: string) {
  document.documentElement.style.setProperty('--color-gain', gain);
  document.documentElement.style.setProperty('--color-loss', loss);
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('obsidian');
  const [avatarUrl, setAvatarState] = useState<string | null>(null);
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFS);

  // Load from API + localStorage on mount
  useEffect(() => {
    // Restore theme
    try {
      const savedTheme = localStorage.getItem('sova-theme') as ThemeId | null;
      if (savedTheme && THEME_VARS[savedTheme]) {
        setThemeState(savedTheme);
        applyTheme(savedTheme);
      }
    } catch { /* ignore */ }

    // Fetch preferences from API
    fetch('/api/preferences')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const merged = { ...DEFAULT_PREFS, ...data };
          setPrefsState(merged);
          applyGainLossColors(merged.gain_color, merged.loss_color);
          // Also restore avatar from DB profile
          fetch('/api/profile')
            .then((r) => r.ok ? r.json() : null)
            .then((profile) => {
              if (profile?.profile_photo) setAvatarState(profile.profile_photo);
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const setTheme = useCallback((t: ThemeId) => {
    setThemeState(t);
    applyTheme(t);
    try { localStorage.setItem('sova-theme', t); } catch { /* ignore */ }
  }, []);

  const setAvatar = useCallback((url: string | null) => {
    setAvatarState(url);
  }, []);

  const setPrefs = useCallback((updates: Partial<UserPreferences>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...updates };
      if (updates.gain_color || updates.loss_color) {
        applyGainLossColors(next.gain_color, next.loss_color);
      }
      return next;
    });
  }, []);

  const savePrefs = useCallback(async (updates: Partial<UserPreferences>) => {
    setPrefs(updates);
    await fetch('/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }, [setPrefs]);

  return (
    <SettingsCtx.Provider value={{ theme, setTheme, avatarUrl, setAvatar, prefs, setPrefs, savePrefs }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export const useSettings = () => useContext(SettingsCtx);

// Convenience hook: returns a formatter that respects the user's currency preference
export function useFmt() {
  const { prefs } = useSettings();
  return useMemo(
    () => (n: number, opts?: { compact?: boolean; decimals?: number }) =>
      formatCurrency(n, prefs.currency, opts),
    [prefs.currency],
  );
}
