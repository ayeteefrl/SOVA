"use client";
// Loaded only through components/hive-gate/HiveMount (next/dynamic), i.e. only when a member's page renders it.
import HiveRoot from "../HiveRoot";
import IndicesPage from "../app/IndicesPage";
import type { HiveEntryProps } from "./types";

export default function IndicesEntry({ userId, isOwner }: HiveEntryProps) {
  return (
    <HiveRoot userId={userId} isOwner={isOwner}>
      <IndicesPage />
    </HiveRoot>
  );
}
