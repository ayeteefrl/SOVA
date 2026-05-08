import type { Holding } from './data';

export type AlertNotification = {
  id: string;
  icon: string;
  color: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
};

const STORAGE_KEY = 'sova_notifications';
const ALERT_CACHE_KEY = 'sova_alert_cache';

function loadAlertCache(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ALERT_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAlertCache(cache: Record<string, string>) {
  try {
    localStorage.setItem(ALERT_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function pushNotification(n: AlertNotification) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items: AlertNotification[] = raw ? JSON.parse(raw) : [];
    items.unshift(n);
    if (items.length > 50) items.length = 50;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

function alreadyFired(key: string): boolean {
  const cache = loadAlertCache();
  const today = new Date().toISOString().slice(0, 10);
  return cache[key] === today;
}

function markFired(key: string) {
  const cache = loadAlertCache();
  cache[key] = new Date().toISOString().slice(0, 10);
  saveAlertCache(cache);
}

function now(): string {
  return new Date().toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// Check portfolio-level alerts
export function checkPortfolioAlerts(
  holdings: Holding[],
  prevNetWorth: number,
): boolean {
  const netWorth = holdings.reduce((a, h) => a + h.value, 0);
  if (netWorth === 0 || prevNetWorth === 0) return false;

  let fired = false;

  const changePct = ((netWorth - prevNetWorth) / prevNetWorth) * 100;

  // Portfolio gained > 2%
  if (changePct >= 2 && !alreadyFired('portfolio-up-2')) {
    pushNotification({
      id: `alert-up-${Date.now()}`,
      icon: 'trending_up',
      color: '#4edea3',
      title: 'Portfolio Up 2%+',
      body: `Your portfolio rose ${changePct.toFixed(1)}% today to ₹${netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      time: now(),
      read: false,
    });
    markFired('portfolio-up-2');
    fired = true;
  }

  // Portfolio dropped > 2%
  if (changePct <= -2 && !alreadyFired('portfolio-down-2')) {
    pushNotification({
      id: `alert-down-${Date.now()}`,
      icon: 'trending_down',
      color: '#ffb2b7',
      title: 'Portfolio Down 2%+',
      body: `Your portfolio fell ${Math.abs(changePct).toFixed(1)}% today to ₹${netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
      time: now(),
      read: false,
    });
    markFired('portfolio-down-2');
    fired = true;
  }

  return fired;
}

// Check individual holding alerts (big movers, stop-loss)
export function checkHoldingAlerts(holdings: Holding[]): boolean {
  let fired = false;

  for (const h of holdings) {
    // Stock dropped > 5% in a day
    if (h.daily <= -5 && !alreadyFired(`drop-5-${h.ticker}`)) {
      pushNotification({
        id: `alert-drop-${h.ticker}-${Date.now()}`,
        icon: 'warning',
        color: '#ffb2b7',
        title: `${h.name} Down ${Math.abs(h.daily).toFixed(1)}%`,
        body: `${h.name} fell sharply today. Current: ₹${h.ltp.toLocaleString('en-IN')} · Avg cost: ₹${h.avgCost.toLocaleString('en-IN')}`,
        time: now(),
        read: false,
      });
      markFired(`drop-5-${h.ticker}`);
      fired = true;
    }

    // Stock rose > 5% in a day
    if (h.daily >= 5 && !alreadyFired(`rise-5-${h.ticker}`)) {
      pushNotification({
        id: `alert-rise-${h.ticker}-${Date.now()}`,
        icon: 'rocket_launch',
        color: '#4edea3',
        title: `${h.name} Up ${h.daily.toFixed(1)}%`,
        body: `${h.name} surged today. Current: ₹${h.ltp.toLocaleString('en-IN')} · Unrealised: ${h.total >= 0 ? '+' : ''}${h.total.toFixed(1)}%`,
        time: now(),
        read: false,
      });
      markFired(`rise-5-${h.ticker}`);
      fired = true;
    }

    // Holding is down > 20% from avg cost (stop-loss territory)
    if (h.total <= -20 && !alreadyFired(`stoploss-${h.ticker}`)) {
      pushNotification({
        id: `alert-sl-${h.ticker}-${Date.now()}`,
        icon: 'shield',
        color: '#D4AF37',
        title: `Stop-Loss Alert: ${h.name}`,
        body: `${h.name} is ${Math.abs(h.total).toFixed(1)}% below your cost (₹${h.avgCost.toLocaleString('en-IN')} → ₹${h.ltp.toLocaleString('en-IN')}). Review position.`,
        time: now(),
        read: false,
      });
      markFired(`stoploss-${h.ticker}`);
      fired = true;
    }
  }

  return fired;
}

// Check watchlist price alerts
export type WatchlistAlert = {
  ticker: string;
  alertAbove?: number;
  alertBelow?: number;
};

export function checkWatchlistAlerts(
  items: { ticker: string; price: number; name: string }[],
  alerts: WatchlistAlert[],
): boolean {
  let fired = false;
  const alertMap = new Map(alerts.map((a) => [a.ticker, a]));

  for (const item of items) {
    const alert = alertMap.get(item.ticker);
    if (!alert) continue;

    if (alert.alertAbove && item.price >= alert.alertAbove && !alreadyFired(`watch-above-${item.ticker}`)) {
      pushNotification({
        id: `alert-watch-above-${item.ticker}-${Date.now()}`,
        icon: 'arrow_upward',
        color: '#4edea3',
        title: `${item.name} Crossed ₹${alert.alertAbove.toLocaleString('en-IN')}`,
        body: `${item.name} is now at ₹${item.price.toLocaleString('en-IN')} — above your target of ₹${alert.alertAbove.toLocaleString('en-IN')}`,
        time: now(),
        read: false,
      });
      markFired(`watch-above-${item.ticker}`);
      fired = true;
    }

    if (alert.alertBelow && item.price <= alert.alertBelow && !alreadyFired(`watch-below-${item.ticker}`)) {
      pushNotification({
        id: `alert-watch-below-${item.ticker}-${Date.now()}`,
        icon: 'arrow_downward',
        color: '#ffb2b7',
        title: `${item.name} Fell Below ₹${alert.alertBelow.toLocaleString('en-IN')}`,
        body: `${item.name} is now at ₹${item.price.toLocaleString('en-IN')} — below your target of ₹${alert.alertBelow.toLocaleString('en-IN')}`,
        time: now(),
        read: false,
      });
      markFired(`watch-below-${item.ticker}`);
      fired = true;
    }
  }

  return fired;
}
