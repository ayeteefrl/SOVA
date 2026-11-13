"use client";
// The frame around every page except the chart: brand, page links, theme.
import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAlerts } from "@/lib/hive/alerts";
import { setState, useStore } from "@/lib/hive/store";
import { setHiveTheme } from "@/lib/hive/user";
import { Icon } from "../ui";
import { useHive } from "../HiveRoot";

export const PAGES = [
  { href: "/charts", label: "Charts" },
  { href: "/charts/scanner", label: "Scanner" },
  { href: "/charts/market", label: "Market" },
  { href: "/charts/filings", label: "Filings" },
  { href: "/charts/indices", label: "Custom Index" },
  { href: "/charts/portfolio", label: "Portfolio" },
];

// Navigation used on the chart page's top bar too.
export function NavLinks({ className = "" }: { className?: string }) {
  const path = usePathname();
  const { unread } = useAlerts(); // also what keeps the keyword-alert checks running on every page
  const { isOwner } = useHive();
  return (
    <nav className={`flex items-center gap-0.5 ${className}`}>
      {PAGES.map((p) => (
        <Link key={p.href} href={p.href} className={`btn px-2.5 ${path === p.href ? "btn-on" : ""}`}>
          {p.label}
          {p.href === "/charts/filings" && unread > 0 && (
            <span className="ml-1.5 rounded-full bg-hive-accent px-1.5 text-2xs font-semibold text-white" title={`${unread} new filings match your alerts`}>
              {unread}
            </span>
          )}
        </Link>
      ))}
      {/* SOVA additions. Plain <a>: leaving /charts (or opening the SOVA-styled access page) is a full page
          load, so each page gets its own Content-Security-Policy. */}
      <div className="divider-v" />
      {isOwner && (
        <a href="/charts/access" className={`btn px-2.5 ${path === "/charts/access" ? "btn-on" : ""}`} title="Who can open Charts (owner only)">
          Access
        </a>
      )}
      <a href="/home" className="btn px-2.5" title="Back to SOVA">
        Back to SOVA
      </a>
    </nav>
  );
}

export default function AppShell({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  const theme = useStore((s) => s.theme);
  useEffect(() => {
    setHiveTheme(theme);
  }, [theme]);
  return (
    <div className="flex h-screen flex-col">
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-hive-line bg-hive-panel px-3">
        <Link href="/charts" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded bg-hive-accent text-[11px] font-bold text-white">CH</span>
          Chart Hive
        </Link>
        <div className="divider-v" />
        <NavLinks />
        <div className="flex-1" />
        {actions}
        <button className="icon-btn" onClick={() => setState({ theme: theme === "dark" ? "light" : "dark" })} title="Light / dark theme">
          <Icon name={theme === "dark" ? "sun" : "moon"} />
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  );
}

// ---------- small pieces the pages share ----------
export const num = (v: number | null | undefined, d = 2) => (v == null || !Number.isFinite(v) ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d }));

export function Pct({ v, className = "" }: { v: number | null | undefined; className?: string }) {
  if (v == null || !Number.isFinite(v)) return <span className={`text-hive-muted ${className}`}>—</span>;
  return <span className={`tabular ${v > 0 ? "text-hive-up" : v < 0 ? "text-hive-down" : "text-hive-muted"} ${className}`}>{`${v > 0 ? "+" : ""}${v.toFixed(2)}%`}</span>;
}

export function Loading({ done, total, what = "market data" }: { done: number; total: number; what?: string }) {
  const p = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="w-72 text-center">
        <div className="mb-3 text-hive-muted">Loading {what}{total ? ` (${done}/${total})` : "…"}</div>
        <div className="h-1.5 overflow-hidden rounded bg-hive-hover">
          <div className="h-full rounded bg-hive-accent transition-all" style={{ width: `${Math.max(4, p)}%` }} />
        </div>
        <div className="mt-3 text-2xs text-hive-muted">The first load reads a year of prices for 500 stocks. After that it&apos;s instant.</div>
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center p-8">
      <div className="max-w-md rounded-lg border border-hive-line bg-hive-panel p-5 text-center">
        <div className="mb-1 font-semibold text-hive-down">Couldn&apos;t load</div>
        <div className="text-hive-muted">{message}</div>
        <div className="mt-2 text-2xs text-hive-muted">Check that the data server is running (npm run dev starts both).</div>
      </div>
    </div>
  );
}
