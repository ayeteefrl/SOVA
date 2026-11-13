"use client";
// Loaded only through components/hive-gate/HiveMount (next/dynamic), i.e. only when a member's page renders it.
import HiveRoot from "../HiveRoot";
import ScannerPage from "../app/ScannerPage";
import type { HiveEntryProps } from "./types";

export default function ScannerEntry({ userId, isOwner }: HiveEntryProps) {
  return (
    <HiveRoot userId={userId} isOwner={isOwner}>
      <ScannerPage />
    </HiveRoot>
  );
}
