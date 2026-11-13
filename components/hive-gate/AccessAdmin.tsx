'use client';
// The owner's Chart Hive access list (SOVA design). Only rendered for the owner; /api/hive/access checks again.
import { useCallback, useEffect, useState } from 'react';

type Member = { userId: string; email: string; note: string | null; createdAt: string };

const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export function AccessAdmin() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/hive/access', { cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg({ ok: false, text: j.error || 'Could not load the access list' });
    setMembers(j.members);
    setTableMissing(Boolean(j.tableMissing));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch('/api/hive/access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, note: note || null }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: j.error || 'Could not add that member' });
    setMsg({ ok: true, text: `${j.member.email} can now open Charts.` });
    setEmail('');
    setNote('');
    load();
  };

  const remove = async (m: Member) => {
    setBusy(true);
    setMsg(null);
    const r = await fetch(`/api/hive/access/${encodeURIComponent(m.userId)}`, { method: 'DELETE' });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return setMsg({ ok: false, text: j.error || 'Could not remove that member' });
    setMsg({ ok: true, text: `${m.email} removed. Any open Charts tab of theirs stops getting data within 10 minutes.` });
    load();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-surface text-on-surface">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold mb-2">SOVA · Charts</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter">Who can open Charts</h1>
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
            <a href="/charts" className="px-4 h-10 inline-flex items-center rounded-lg bg-surface-container-highest/60 hover:bg-surface-container-highest">Charts</a>
            <a href="/home" className="px-4 h-10 inline-flex items-center rounded-lg bg-surface-container-highest/60 hover:bg-surface-container-highest">SOVA</a>
          </div>
        </div>

        {tableMissing && (
          <div className="rounded-xl bg-tertiary/10 p-4 text-sm text-on-surface-variant">
            The <code>hive_access</code> table doesn&apos;t exist yet, so only you can get in. Run <code>supabase-hive-access.sql</code> in Supabase to invite people.
          </div>
        )}

        <form onSubmit={add} className="rounded-xl bg-surface-container-low p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-outline">Invite an existing SOVA account</p>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="their SOVA sign-in email"
              className="flex-1 h-11 rounded-lg bg-surface-container-high px-3 text-sm outline-none focus:ring-1 focus:ring-primary/50"
            />
            <input
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="note (optional)"
              className="md:w-48 h-11 rounded-lg bg-surface-container-high px-3 text-sm outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              disabled={busy || !email}
              className="h-11 px-5 rounded-lg text-[10px] font-black uppercase tracking-widest gradient-primary text-on-primary-container disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-outline">
            Only accounts that already exist can be added. SOVA doesn&apos;t verify email addresses at sign-up, so
            invite only accounts you know belong to that person.
          </p>
        </form>

        {msg && <div className={`rounded-lg p-3 text-sm ${msg.ok ? 'bg-secondary/10 text-secondary' : 'bg-tertiary/10 text-tertiary'}`}>{msg.text}</div>}

        <div className="rounded-xl bg-surface-container-low">
          <div className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-outline">
            Members {members ? `(${members.length})` : ''} · you (the owner) always have access
          </div>
          {!members ? (
            <div className="px-5 pb-5 text-sm text-outline">Loading…</div>
          ) : members.length === 0 ? (
            <div className="px-5 pb-5 text-sm text-outline">Nobody else yet.</div>
          ) : (
            <ul>
              {members.map((m) => (
                <li key={m.userId} className="flex items-center gap-4 px-5 py-3 odd:bg-surface-container/40">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{m.email}</div>
                    <div className="text-xs text-outline">
                      Added {fmtDate(m.createdAt)}
                      {m.note ? ` · ${m.note}` : ''}
                    </div>
                  </div>
                  {confirm === m.userId ? (
                    <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
                      <button disabled={busy} onClick={() => remove(m)} className="px-3 h-9 rounded-lg bg-tertiary/20 text-tertiary">Remove</button>
                      <button onClick={() => setConfirm(null)} className="px-3 h-9 rounded-lg bg-surface-container-highest/60">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirm(m.userId)} className="px-3 h-9 rounded-lg text-[10px] font-black uppercase tracking-widest text-outline hover:text-tertiary">
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
