"use client";
// The frame every Chart Hive page renders in. Only reached by the owner and invited members: app/charts pages
// check access on the server before rendering this, so nobody else downloads this code, its CSS or its fonts.
//
// - .hive-root carries Chart Hive's palette (CSS variables) and scopes its stylesheet (hive.css, built with
//   tailwind.hive.config.ts), so nothing leaks into SOVA and SOVA's globals don't restyle the terminal.
// - Inter and JetBrains Mono load here only (SOVA uses Manrope).
// - The SOVA user id namespaces every localStorage key (lib/hive/user.ts).
import { createContext, useContext, type ReactNode } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { setHiveUser } from "@/lib/hive/user";
import "./hive.css";

const sans = Inter({ subsets: ["latin"], variable: "--hive-font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--hive-font-mono" });

const HiveCtx = createContext<{ isOwner: boolean }>({ isOwner: false });
/** UI hint only (shows the owner's "Access" link). The access page and its API check on the server. */
export const useHive = () => useContext(HiveCtx);

export default function HiveRoot({ userId, isOwner, children }: { userId: string; isOwner: boolean; children: ReactNode }) {
  // Before any child renders, so the very first store read already uses this user's keys.
  setHiveUser(userId);
  return (
    <HiveCtx.Provider value={{ isOwner }}>
      <div className={`hive-root ${sans.variable} ${mono.variable}`}>{children}</div>
    </HiveCtx.Provider>
  );
}
