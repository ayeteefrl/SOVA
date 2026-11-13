"use client";
// Loaded only through components/hive-gate/HiveMount (next/dynamic), i.e. only when a member's page renders it.
import HiveRoot from "../HiveRoot";
import HiveTerminal from "../HiveTerminal";
import type { HiveEntryProps } from "./types";

export default function TerminalEntry({ userId, isOwner, initialSymbol }: HiveEntryProps) {
  return (
    <HiveRoot userId={userId} isOwner={isOwner}>
      <HiveTerminal initialSymbol={initialSymbol ?? null} />
    </HiveRoot>
  );
}
