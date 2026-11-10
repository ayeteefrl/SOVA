/**
 * Every external source SOVA pulls data from. Keep in sync with the API routes/clients:
 *  - Upstox:       lib/upstox-client.ts (Indian stocks, ETFs, NSE/BSE indices, holdings)
 *  - Yahoo:        app/api/market, app/api/stock, app/api/search (global indices, commodities, US search, fallback)
 *  - Massive:      lib/massive-client.ts (US stocks/indices, crypto, forex, news)
 *  - Brokers:      Zerodha Kite, Angel One, Groww (user holdings & trades)
 *  - CAMS/casparser: mutual fund statement parsing
 *  - NSI India:    PPF interest rate
 *  - News RSS:     Economic Times, Business Standard, Mint, NDTV Profit, Reuters
 */
export const DATA_SOURCES = [
  'Upstox',
  'Yahoo Finance',
  'Massive',
  'Zerodha Kite',
  'Angel One',
  'Groww',
  'CAMS (casparser)',
  'NSI India',
  'Economic Times',
  'Business Standard',
  'Mint',
  'NDTV Profit',
  'Reuters',
] as const;

export const DATA_SOURCES_TEXT = DATA_SOURCES.join(' · ');
