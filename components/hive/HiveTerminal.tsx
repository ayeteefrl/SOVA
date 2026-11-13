"use client";
import dynamic from "next/dynamic";

// The terminal is all canvas and websockets, so it only renders in the browser (as in the original app/page.tsx).
const Terminal = dynamic(() => import("./terminal/Terminal"), {
  ssr: false,
  loading: () => <div className="grid h-screen place-items-center text-hive-muted">Loading Chart Hive…</div>,
});

export default function HiveTerminal({ initialSymbol }: { initialSymbol: string | null }) {
  return <Terminal initialSymbol={initialSymbol} />;
}
