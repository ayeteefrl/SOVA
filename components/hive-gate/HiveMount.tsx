'use client';
// The only client module the /charts pages import. Next ships every client component a page imports, even
// one the page doesn't render, so the Hive UI (its code, its CSS and its fonts) is loaded here with
// next/dynamic instead: it is fetched only when this component renders, which the server does only for the
// owner and invited members. Non-members get the server-rendered invite-only page and none of this code.
import dynamic from 'next/dynamic';
import type { HiveEntryProps } from '@/components/hive/entries/types';

const ENTRIES = {
  terminal: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Terminal')),
  scanner: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Scanner')),
  market: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Market')),
  filings: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Filings')),
  indices: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Indices')),
  portfolio: dynamic<HiveEntryProps>(() => import('@/components/hive/entries/Portfolio')),
};
const AccessAdmin = dynamic(() => import('./AccessAdmin').then((m) => m.AccessAdmin));

export type HivePage = keyof typeof ENTRIES;

export default function HiveMount({ page, ...props }: HiveEntryProps & { page: HivePage }) {
  const Entry = ENTRIES[page];
  return <Entry {...props} />;
}

export function AccessAdminMount() {
  return <AccessAdmin />;
}
