export type AllocationSlice = {
  label: string;
  currentValue: number;
  currentPct: number;
  targetPct: number;
  driftPct: number;
  action: 'BUY' | 'SELL' | 'HOLD';
  amountToTrade: number;
  taxImpact?: string;
};

export type RebalancePlan = {
  slices: AllocationSlice[];
  totalValue: number;
  totalDrift: number;
  needsAction: boolean;
};

export function computeRebalancePlan(
  current: { label: string; value: number }[],
  targets: Record<string, number>,
): RebalancePlan {
  const totalValue = current.reduce((a, s) => a + s.value, 0);
  if (totalValue === 0) {
    return {
      slices: [],
      totalValue: 0,
      totalDrift: 0,
      needsAction: false,
    };
  }

  const slices: AllocationSlice[] = current.map((s) => {
    const currentPct = (s.value / totalValue) * 100;
    const targetPct = targets[s.label] ?? currentPct;
    const driftPct = currentPct - targetPct;
    const targetValue = (targetPct / 100) * totalValue;
    const amountToTrade = Math.abs(s.value - targetValue);

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    if (driftPct > 2) action = 'SELL';
    else if (driftPct < -2) action = 'BUY';

    let taxImpact: string | undefined;
    if (action === 'SELL' && amountToTrade > 0) {
      // Rough LTCG estimate at 12.5% on equity gains over 1L
      const estimatedGain = amountToTrade * 0.1;
      const taxable = Math.max(0, estimatedGain - 100000);
      if (taxable > 0) {
        taxImpact = `~₹${Math.round(taxable * 0.125).toLocaleString('en-IN')} LTCG tax`;
      }
    }

    return {
      label: s.label,
      currentValue: s.value,
      currentPct,
      targetPct,
      driftPct,
      action,
      amountToTrade,
      taxImpact,
    };
  });

  const totalDrift = slices.reduce((a, s) => a + Math.abs(s.driftPct), 0) / 2;

  return {
    slices,
    totalValue,
    totalDrift,
    needsAction: totalDrift > 3,
  };
}

export function formatRebalanceSuggestion(slice: AllocationSlice): string {
  if (slice.action === 'HOLD') return 'On target — no action needed';
  const verb = slice.action === 'BUY' ? 'Increase' : 'Reduce';
  const amount = `₹${Math.round(slice.amountToTrade).toLocaleString('en-IN')}`;
  return `${verb} by ${amount} (${Math.abs(slice.driftPct).toFixed(1)}% drift)`;
}
