// "Open chart" ticker mapping and /charts?symbol= validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nseTickerFrom, parseSymbolParam, chartHref } from '../../lib/hive/symbol-param.ts';

test('broker ticker formats map to an NSE ticker', () => {
  const cases: [string | null | undefined, string | null][] = [
    ['RELIANCE', 'RELIANCE'], // Zerodha / Upstox / Groww
    ['reliance', 'RELIANCE'],
    ['RELIANCE-EQ', 'RELIANCE'], // Angel One
    ['XYZ-BE', 'XYZ'],
    ['TCS.NS', 'TCS'],
    ['TCS.BO', 'TCS'],
    ['NSE:INFY', 'INFY'],
    ['BSE:500325', null], // BSE scrip code: no letters, not an NSE ticker
    ['M&M', 'M&M'],
    ['BAJAJ-AUTO', 'BAJAJ-AUTO'],
    [' hdfc bank ', 'HDFCBANK'],
    ['INE002A01018', null], // ISIN (mutual-fund style entries)
    ['Axis Bluechip Fund - Direct Growth', null],
    ['', null],
    [null, null],
    [undefined, null],
  ];
  for (const [input, want] of cases) assert.equal(nseTickerFrom(input), want, String(input));
});

test('chart links encode special characters', () => {
  assert.equal(chartHref('M&M'), '/charts?symbol=NSE%3AM%26M');
});

test('?symbol= accepts EXCHANGE:TICKER only', () => {
  assert.equal(parseSymbolParam('NSE:TCS'), 'NSE:TCS');
  assert.equal(parseSymbolParam('nse:m&m'), 'NSE:M&M');
  assert.equal(parseSymbolParam('MCX:CRUDEOIL1!'), 'MCX:CRUDEOIL1!');
  assert.equal(parseSymbolParam('YAHOO:^GSPC'), 'YAHOO:^GSPC');
  for (const bad of ['TCS', '', 'NSE:', ':TCS', 'NSE:TCS<script>', 'javascript:alert(1)', 'NSE:' + 'A'.repeat(31), undefined, ['NSE:TCS', 'NSE:INFY']])
    assert.equal(parseSymbolParam(bad as string | string[] | undefined), null, String(bad));
});
