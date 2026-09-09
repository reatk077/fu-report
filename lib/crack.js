// 产业链价差（含换算）
import { BARRELS_PER_TONNE } from './constants.js';
const perTonne = (sc) => (sc || 0) * BARRELS_PER_TONNE;
export function spreads(quotes) {
  const fu = quotes.FU0, sc = quotes.SC0, lu = quotes.LU0, brent = quotes.OIL, wti = quotes.CL;
  const scT = perTonne(sc?.latest);
  return {
    crackFU: fu && sc ? +((fu.latest - scT)).toFixed(0) : null,            // 元/吨
    crackLU: lu && sc ? +((lu.latest - scT)).toFixed(0) : null,
    lsSpread: fu && lu ? +((lu.latest - fu.latest)).toFixed(0) : null,     // LU-FU 高低硫
    brentWti: brent && wti ? +((brent.latest - wti.latest)).toFixed(2) : null,
    scPerTonne: +scT.toFixed(0),
    crackFU_pct: fu && sc ? +((fu.latest / scT - 1) * 100).toFixed(1) : null,
    crackLU_pct: lu && sc ? +((lu.latest / scT - 1) * 100).toFixed(1) : null,
    lsSpread_pct: fu && lu ? +((lu.latest / fu.latest - 1) * 100).toFixed(1) : null,
    note: 'SC为元/桶，×7.33≈元/吨；crackFU=FU-SC×7.33；crackLU=LU-SC×7.33；LSspread=LU-FU',
  };
}
// 历史价差序列（用日线收盘均值）
export function spreadSeries(dailyA, dailyB, use) {
  // dailyA, dailyB: [{date,close}] ; use: 'aMinusB'
  const n = Math.min(dailyA.length, dailyB.length);
  const out = [];
  for (let i = n - 60; i < n; i++) {
    if (i < 0) continue;
    out.push({ date: dailyA[i].date, value: +(dailyA[i].close - dailyB[i].close).toFixed(0) });
  }
  return out;
}
