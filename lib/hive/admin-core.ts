// Input checks for the owner's access-list routes (pure, unit-tested).

export function parseEmail(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < 3 || s.length > 254) return null;
  return /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]+$/.test(s) ? s : null;
}

export function parseNote(v: unknown): string | null | undefined {
  if (v == null || v === '') return null;
  if (typeof v !== 'string') return undefined; // invalid
  const s = v.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  return s.length <= 200 ? s || null : undefined;
}

/** Escape LIKE wildcards so an email is matched literally by ilike. */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * SOVA stores emails exactly as typed and does not normalise case, so "A@x.com" and "a@x.com" can be two
 * accounts. Prefer an exact match; otherwise accept a case-insensitive match only when it is unique.
 */
export function pickAccount<T extends { email: string }>(email: string, exact: T[], insensitive: T[]): { account: T } | { error: 'none' | 'ambiguous' } {
  if (exact.length === 1) return { account: exact[0] };
  if (exact.length > 1) return { error: 'ambiguous' };
  const lower = email.toLowerCase();
  const same = insensitive.filter((u) => u.email.toLowerCase() === lower);
  if (same.length === 1) return { account: same[0] };
  return { error: same.length ? 'ambiguous' : 'none' };
}
