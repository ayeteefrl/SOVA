import { Holding, ActivityItem } from './data';

// Extract ticker from activity title or detail
export function extractTickerFromActivity(activity: ActivityItem): string | null {
  // List of known tickers
  const knownTickers = [
    'RELIANCE',
    'HDFCBANK',
    'TCS',
    'INFY',
    'ICICIBANK',
    'BAJFINANCE',
    'ASIANPAINT',
    'LT',
    'ZOMATO',
    'NYKAA',
    'DMART',
    'IRCTC',
    'POLYCAB',
    'ADANI',
  ];

  // Try to find ticker in title
  for (const ticker of knownTickers) {
    if (activity.title.toUpperCase().includes(ticker)) {
      return ticker;
    }
  }

  // Try to find ticker in detail
  for (const ticker of knownTickers) {
    if (activity.detail.toUpperCase().includes(ticker)) {
      return ticker;
    }
  }

  return null;
}

// Calculate average cost after a buy or sell
export function calculateAvgCost(
  currentUnits: number,
  currentAvgCost: number,
  newUnits: number,
  newPrice: number,
  isBuy: boolean
): number {
  if (isBuy) {
    if (currentUnits === 0) {
      return newPrice;
    }
    return (currentUnits * currentAvgCost + newUnits * newPrice) / (currentUnits + newUnits);
  } else {
    // Sell order - keep avg cost unless all units sold
    if (currentUnits <= newUnits) {
      return 0; // All units sold
    }
    return currentAvgCost; // Cost basis doesn't change on partial sell
  }
}

// Apply a single activity to holdings and return updated holdings array
export function applyActivityToHoldings(activity: ActivityItem, holdings: Holding[]): Holding[] {
  const category = activity.category.toUpperCase();

  if (category === 'TRADE') {
    // Only process trade activities
    const ticker = extractTickerFromActivity(activity);
    if (!ticker) return holdings;

    const isBuy = activity.detail?.toLowerCase().includes('buy') ?? false;
    const holdingIndex = holdings.findIndex((h) => h.ticker?.toUpperCase() === ticker.toUpperCase());

    if (holdingIndex >= 0) {
      const holding = holdings[holdingIndex];
      const newHoldings = [...holdings];

      // Parse units from activity detail
      // Simplified: extract any number that might be units
      const unitsMatch = activity.detail.match(/(\d+)\s*units/i);
      const units = unitsMatch ? parseFloat(unitsMatch[1]) : 1;

      // Parse price from activity detail
      const priceMatch = activity.detail.match(/₹?([\d,]+(?:\.\d{2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : holding.ltp;

      const newUnits = isBuy ? holding.units + units : Math.max(0, holding.units - units);
      const newAvgCost = calculateAvgCost(holding.units, holding.avgCost, units, price, isBuy);
      const newValue = newUnits * (price || holding.ltp);

      newHoldings[holdingIndex] = {
        ...holding,
        units: newUnits,
        avgCost: newAvgCost,
        ltp: price,
        value: newValue,
        // Keep other fields as-is, will be recalculated at portfolio level
      };

      return newHoldings;
    } else {
      // Create new holding if doesn't exist
      const unitsMatch = activity.detail.match(/(\d+)\s*units/i);
      const units = unitsMatch ? parseFloat(unitsMatch[1]) : 1;

      const priceMatch = activity.detail.match(/₹?([\d,]+(?:\.\d{2})?)/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 100;

      const newHolding: Holding = {
        id: `${ticker}-${Date.now()}`,
        name: ticker,
        ticker,
        units,
        avgCost: price,
        ltp: price,
        value: units * price,
        daily: 0,
        total: 0,
        weight: 0,
        sector: 'Unknown',
      };

      return [...holdings, newHolding];
    }
  }

  return holdings;
}

// Batch apply multiple activities (in case of recovery from log)
export function applyMultipleActivities(activities: ActivityItem[], holdings: Holding[]): Holding[] {
  return activities.reduce((acc, activity) => applyActivityToHoldings(activity, acc), holdings);
}
