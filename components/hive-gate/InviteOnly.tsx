// Shown at /charts and every /charts/* route to signed-in SOVA users who aren't invited.
// A server component in SOVA's own design: no Chart Hive code, no client JS, no data-server calls.

export function InviteOnly() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-surface flex items-center justify-center p-6">
      <section className="relative overflow-hidden w-full max-w-lg rounded-xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-low p-8 md:p-10 shadow-elevated">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 rounded-pill blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-surface-container-highest/60 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-gold text-2xl">lock</span>
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-gold mb-3">SOVA · Charts</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-on-surface leading-tight">
            Charts is invite-only
          </h1>
          <p className="text-sm text-on-surface-variant font-medium mt-4 leading-relaxed">
            The charting terminal, scanner and filings tools are open to invited SOVA accounts only.
            Your account hasn&apos;t been invited yet. Everything else in SOVA works as usual.
          </p>
          <a
            href="/home"
            className="mt-8 inline-flex px-5 h-11 items-center gap-2 rounded-lg text-[10px] font-black uppercase tracking-widest bg-surface-container-highest/60 text-on-surface hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to SOVA
          </a>
        </div>
      </section>
    </div>
  );
}
