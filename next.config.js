const isDev = process.env.NODE_ENV !== 'production';

// Every third-party origin the browser itself talks to. Broker/market-data
// APIs (Zerodha, Angel, Groww, Upstox, Yahoo Finance) are all called
// server-side from route handlers, so they don't need to appear here.
const csp = [
  `default-src 'self'`,
  // Next.js App Router ships an inline bootstrap script; a nonce-based CSP
  // would remove the need for 'unsafe-inline' here but requires middleware
  // and per-integration testing (Vercel Analytics/Speed Insights included).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Framer Motion animates via inline style attributes — no nonce mechanism covers those.
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: https://lh3.googleusercontent.com https://images.unsplash.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ];
  },
};

module.exports = nextConfig;
