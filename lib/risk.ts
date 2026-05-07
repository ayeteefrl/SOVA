import type { Holding } from './data';

export function computeRisk(holdings: Holding[]) {
  const total = holdings.reduce((s, h) => s + h.value, 0);
  if (total === 0) return { score: 0, hhi: 0, top5: 0, tips: [] as { icon: string; color: string; text: string }[] };

  const weights = holdings.map((h) => h.value / total);
  const hhi = weights.reduce((s, w) => s + w * w, 0);

  const sorted = [...weights].sort((a, b) => b - a);
  const top5 = sorted.slice(0, 5).reduce((s, w) => s + w, 0);

  const sectors = new Set(holdings.map((h) => h.sector).filter(Boolean));
  const sectorScore = Math.min(sectors.size / 8, 1);
  const holdingScore = Math.min(holdings.length / 15, 1);
  const avgVol = holdings.reduce((s, h) => s + Math.abs(h.daily) * (h.value / total), 0);
  const volScore = Math.max(0, 1 - avgVol / 3);

  const raw =
    (1 - hhi) * 0.30 +
    (1 - top5) * 0.25 +
    sectorScore * 0.20 +
    holdingScore * 0.15 +
    volScore * 0.10;

  const score = Math.round(raw * 100);

  const tips: { icon: string; color: string; text: string }[] = [];
  if (hhi > 0.2) tips.push({ icon: 'warning', color: '#ffb2b7', text: 'High single-stock concentration — consider trimming top 2 positions.' });
  else tips.push({ icon: 'check_circle', color: '#4edea3', text: 'Stock concentration within healthy bounds.' });
  if (top5 > 0.6) tips.push({ icon: 'pie_chart', color: '#D4AF37', text: `Top 5 holdings = ${(top5 * 100).toFixed(0)}% of equity. Rotate ₹ into smaller positions.` });
  if (sectors.size < 5) tips.push({ icon: 'account_tree', color: '#ffb2b7', text: 'Fewer than 5 sectors — increase sector breadth to reduce systemic risk.' });
  else tips.push({ icon: 'check_circle', color: '#4edea3', text: `${sectors.size} sectors represented — good diversification.` });
  if (avgVol > 2) tips.push({ icon: 'bolt', color: '#D4AF37', text: `Avg daily move ${avgVol.toFixed(2)}% — consider adding low-beta defensives.` });
  else tips.push({ icon: 'check_circle', color: '#4edea3', text: 'Portfolio volatility is contained.' });
  if (holdings.length < 8) tips.push({ icon: 'add_circle', color: '#ffb2b7', text: 'Under 8 holdings — add positions to spread idiosyncratic risk.' });

  return { score, hhi, top5, tips };
}
