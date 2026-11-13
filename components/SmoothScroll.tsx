'use client';

import { ReactLenis } from 'lenis/react';

// Lenis on a scroll container (the app scrolls inside <main>, not the window).
export function SmoothScroll({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ReactLenis className={className} options={{ lerp: 0.1, duration: 1.2 }}>
      {children}
    </ReactLenis>
  );
}
