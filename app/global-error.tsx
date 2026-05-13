'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body style={{ background: '#0d1322', color: '#dde2f8', fontFamily: 'Manrope, system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 32 }}>⚠</span>
        <p style={{ fontWeight: 900, fontSize: 16, margin: 0 }}>Something went wrong</p>
        <p style={{ fontSize: 11, color: '#717fa0', margin: 0 }}>{error.message || 'An unexpected error occurred.'}</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: 8, padding: '8px 20px', background: '#4d8eff', color: '#001a42', border: 'none', borderRadius: 8, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
