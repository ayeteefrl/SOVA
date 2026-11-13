const isDev = process.env.NODE_ENV !== 'production';

// Every third-party origin the browser itself talks to. Broker/market-data
// APIs (Zerodha, Angel, Groww, Upstox, Yahoo Finance) are all called
// server-side from route handlers, so they don't need to appear here.
const cspFor = ({ connect = [], img = [], script = [] } = {}) => [
  `default-src 'self'`,
  // Next.js App Router ships an inline bootstrap script; a nonce-based CSP
  // would remove the need for 'unsafe-inline' here but requires middleware
  // and per-integration testing (Vercel Analytics/Speed Insights included).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}${script.map((s) => ' ' + s).join('')}`,
  // Framer Motion animates via inline style attributes — no nonce mechanism covers those.
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: https://lh3.googleusercontent.com https://images.unsplash.com${img.map((s) => ' ' + s).join('')}`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self'${connect.map((s) => ' ' + s).join('')}`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

const csp = cspFor();

// Charts (Chart Hive) talks to its data server directly (https + wss; Vercel can't proxy websockets). Its
// origin comes from NEXT_PUBLIC_HIVE_DATA_URL, so moving the data server is only an env/DNS change. Only the
// /charts pages get it. Links into and out of /charts are full page loads, so each page keeps its own policy.
function hiveDataOrigins() {
  const out = new Set();
  const add = (raw) => {
    try {
      const u = new URL(raw);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return;
      out.add(u.origin);
      out.add(u.origin.replace(/^http/, 'ws'));
    } catch {
      /* unset or invalid: nothing added */
    }
  };
  add(process.env.NEXT_PUBLIC_HIVE_DATA_URL || '');
  if (isDev) add('http://localhost:4200'); // local hive-server
  return [...out];
}
// blob: images: the drawing tools' image upload and the watchlist screenshot import read local files.
const chartsCsp = cspFor({ connect: hiveDataOrigins(), img: ['blob:'] });
// The self-hosted OCR worker (public/hive/tesseract) compiles WebAssembly; a worker uses its own script's
// response headers, so only these files get 'wasm-unsafe-eval'.
const tesseractCsp = cspFor({ script: ["'wasm-unsafe-eval'"] });

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optional, for building next to a running `next dev` (which locks .next on Windows). Default unchanged.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  reactStrictMode: true,
  serverExternalPackages: ['kiteconnect'],
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), camera=(), microphone=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
      // Later entries override the CSP above for these paths only (Next: "the last header key will override").
      { source: '/charts', headers: [{ key: 'Content-Security-Policy', value: chartsCsp }] },
      { source: '/charts/:path*', headers: [{ key: 'Content-Security-Policy', value: chartsCsp }] },
      { source: '/hive/tesseract/:path*', headers: [{ key: 'Content-Security-Policy', value: tesseractCsp }] },
    ];
  },
};

module.exports = nextConfig;
