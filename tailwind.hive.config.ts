import type { Config } from 'tailwindcss';

// Chart Hive's own Tailwind build (components/hive/hive.css), separate from SOVA's tailwind.config.ts:
// - Tailwind's DEFAULT theme (SOVA overrides border radii and fonts; Chart Hive was built on the defaults),
//   plus Chart Hive's palette as hive-* colours read from CSS variables on .hive-root.
// - Every utility is scoped under .hive-root (important selector strategy), which also makes it outrank SOVA's
//   identically named utilities (e.g. SOVA's rounded-full is 0.75rem) inside the terminal.
// - No preflight: SOVA's globals.css already includes the same Tailwind 3 reset.
const v = (name: string) => `rgb(var(--hive-${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./components/hive/**/*.{ts,tsx}', './lib/hive/**/*.{ts,tsx}'],
  important: '.hive-root',
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        'hive-bg': v('bg'),
        'hive-panel': v('panel'),
        'hive-raised': v('raised'),
        'hive-hover': v('hover'),
        'hive-line': v('line'),
        'hive-text': v('text'),
        'hive-muted': v('muted'),
        'hive-accent': v('accent'),
        'hive-up': v('up'),
        'hive-down': v('down'),
      },
      fontFamily: {
        sans: ['var(--hive-font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--hive-font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: { '2xs': ['10px', '14px'] },
    },
  },
  plugins: [],
};

export default config;
