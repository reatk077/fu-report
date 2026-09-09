// 技术指标：均线、ATR、RSI、区间位置、方向
export function sma(arr, n) {
  return arr.map((_, i) => { if (i < n - 1) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += arr[j]; return +(s / n).toFixed(2); });
}
export function atr(daily, n = 14) {
  // daily: [{high,low,close}]
  const tr = [];
  for (let i = 0; i < daily.length; i++) {
    const d = daily[i], p = daily[i - 1];
    const hh = d.high, ll = d.low, pc = p ? p.close : d.close;
    tr.push(Math.max(hh - ll, Math.abs(hh - pc), Math.abs(ll - pc)));
  }
  return tr.map((_, i) => { if (i < n - 1) return null; let s = 0; for (let j = i - n + 1; j <= i; j++) s += tr[j]; return +(s / n).toFixed(2); });
}
export function rsi(closes, n = 14) {
  const out = Array(closes.length).fill(null);
  let up = 0, dn = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1], g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    if (i <= n) { up += g; dn += l; if (i === n) { up /= n; dn /= n; out[i] = dn === 0 ? 100 : +(100 - 100 / (1 + up / dn)).toFixed(2); } }
    else { up = (up * (n - 1) + g) / n; dn = (dn * (n - 1) + l) / n; out[i] = dn === 0 ? 100 : +(100 - 100 / (1 + up / dn)).toFixed(2); }
  }
  return out;
}
// 对某主力日线生成趋势/技术面
export function face(daily, cfg = { maArr: [5,10,20,60], atrPeriod: 14, rsiPeriod: 14, lookback20: 20, lookback60: 60 }) {
  const closes = daily.map(d => d.close);
  const last = daily[daily.length - 1];
  const prev = daily[daily.length - 2] || last;
  const ma = {};
  for (const n of cfg.maArr) ma[n] = +closes.slice(-n).reduce((a, b) => a + b, 0) / n;
  const atrArr = atr(daily, cfg.atrPeriod);
  const rsiArr = rsi(closes, cfg.rsiPeriod);
  const amplitude = +((last.high - last.low) / (last.close || 1) * 100).toFixed(2);
  const win20 = daily.slice(-cfg.lookback20), win60 = daily.slice(-cfg.lookback60);
  const high20 = Math.max(...win20.map(d => d.high)), low20 = Math.min(...win20.map(d => d.low));
  const high60 = Math.max(...win60.map(d => d.high)), low60 = Math.min(...win60.map(d => d.low));
  const pos20 = high20 === low20 ? 50 : +((last.close - low20) / (high20 - low20) * 100).toFixed(1);
  const cum20 = +((last.close / (win20[0].close || 1) - 1) * 100).toFixed(2);
  const ma5 = ma[5], ma10 = ma[10], ma20 = ma[20];
  let direction = '震荡';
  if (ma5 > ma10 && ma10 > ma20 && last.close > ma20) direction = '多头排列(偏强)';
  else if (ma5 < ma10 && ma10 < ma20 && last.close < ma20) direction = '空头排列(偏弱)';
  else if (last.close > ma20) direction = '站上MA20(偏强)';
  else if (last.close < ma20) direction = '跌破MA20(偏弱)';
  const rsiVal = rsiArr[rsiArr.length - 1];
  return {
    close: last.close, changePct: last.close && prev.close ? +((last.close / prev.close - 1) * 100).toFixed(2) : 0,
    ma, ma5, ma10, ma20, ma60: +closes.slice(-60).reduce((a, b) => a + b, 0) / 60, atr: atrArr[atrArr.length - 1], rsi: rsiVal,
    amplitude, high20, low20, high60, low60, pos20, cum20, direction,
    rsiState: rsiVal == null ? '' : rsiVal >= 70 ? '超买' : rsiVal <= 30 ? '超卖' : '中性',
    support: low20, resistance: high20,
  };
}
