// 日内"下探/上探"扫描：以开盘后稳定基准价为锚，统计日盘 09:00-15:00 的偏离。
import { DIPSPIKE, DEFAULT_REPORT_FRAME } from './constants.js';

function baselineOf(bars, labels) {
  const sel = bars.filter(b => labels.includes(b.t));
  if (!sel.length) return null;
  return sel.reduce((s, b) => s + b.close, 0) / sel.length;
}
function scanExcursions(bars, baseline, startLabel) {
  const thresh = baseline * DIPSPIKE.thresholdPct / 100;
  const dips = [], spikes = [];
  let inDip = false, dipMin = Infinity, dipStart = null;
  let inSpike = false, spikeMax = -Infinity, spikeStart = null;
  for (const b of bars) {
    if (b.t < startLabel) continue;
    if (!inDip && b.close < baseline - thresh) { inDip = true; dipMin = b.low; dipStart = b.t; }
    else if (inDip) {
      dipMin = Math.min(dipMin, b.low);
      if (b.close >= baseline) { dips.push({ start: dipStart, end: b.t, depth: +((baseline - dipMin) / baseline * 100).toFixed(2) }); inDip = false; }
    }
    if (!inSpike && b.close > baseline + thresh) { inSpike = true; spikeMax = b.high; spikeStart = b.t; }
    else if (inSpike) {
      spikeMax = Math.max(spikeMax, b.high);
      if (b.close <= baseline) { spikes.push({ start: spikeStart, end: b.t, depth: +((spikeMax - baseline) / baseline * 100).toFixed(2) }); inSpike = false; }
    }
  }
  if (inDip) dips.push({ start: dipStart, end: '15:00(未收回)', depth: +((baseline - dipMin) / baseline * 100).toFixed(2), open: true });
  if (inSpike) spikes.push({ start: spikeStart, end: '15:00(未收回)', depth: +((spikeMax - baseline) / baseline * 100).toFixed(2), open: true });
  return { dips, spikes };
}
function summarize(events) {
  if (!events.length) return { n: 0, depths: [], avg: 0, max: 0 };
  const depths = events.map(e => e.depth);
  return { n: events.length, depths, avg: +(depths.reduce((a, b) => a + b, 0) / depths.length).toFixed(2), max: Math.max(...depths) };
}
function groupDaySession(rows, tradeDates) {
  const out = {}; // td -> [{t,open,high,low,close}]
  const set = new Set(tradeDates);
  for (const r of rows) {
    const hhmm = r.time;
    if (hhmm >= '21:00' || hhmm < '09:00') continue;   // 只统计日盘
    if (!set.has(r.date)) continue;
    (out[r.date] = out[r.date] || []).push({ t: hhmm, open: r.open, high: r.high, low: r.low, close: r.close });
  }
  return out;
}
function runWindow(rows, cfg, tradeDates) {
  const byDay = groupDaySession(rows, tradeDates);
  const res = {};
  for (const td of tradeDates) {
    const bars = (byDay[td] || []).slice().sort((a, b) => a.t.localeCompare(b.t));
    if (!bars.length) continue;
    const base = baselineOf(bars, cfg.labels);
    if (base == null) continue;
    const { dips, spikes } = scanExcursions(bars, base, cfg.start);
    res[td] = { gran: cfg.gran, baseline: +base.toFixed(1), dips: summarize(dips), spikes: summarize(spikes), dipEvents: dips, spikeEvents: spikes, bars };
  }
  return res;
}
function winSummary(res, days) {
  let dN = 0, sN = 0; const dDep = [], sDep = [];
  for (const td of days) { const r = res[td]; if (!r) continue; dN += r.dips.n; sN += r.spikes.n; dDep.push(...r.dips.depths); sDep.push(...r.spikes.depths); }
  return {
    days: days.length, covered: days.filter(td => res[td]).length, dipN: dN, spikeN: sN, total: dN + sN,
    dipAvgDepth: dDep.length ? +(dDep.reduce((a, b) => a + b, 0) / dDep.length).toFixed(2) : 0,
    dipMaxDepth: dDep.length ? Math.max(...dDep) : 0,
    spikeAvgDepth: sDep.length ? +(sDep.reduce((a, b) => a + b, 0) / sDep.length).toFixed(2) : 0,
    spikeMaxDepth: sDep.length ? Math.max(...sDep) : 0,
  };
}
export function dipspike({ daily, min5, min15, min1 }) {
  if (!daily || !daily.length) return null;
  const tradeDates = daily.map(d => d.date);
  const last7 = daily.slice(-7).map(d => d.date), last30 = daily.slice(-30).map(d => d.date), last60 = daily.slice(-60).map(d => d.date);
  const w7 = runWindow(min5 || [], DIPSPIKE.windows.w7, tradeDates);
  const w30 = runWindow(min15 || [], DIPSPIKE.windows.w30, tradeDates);
  const w1 = runWindow(min1 || [], { gran: 1, labels: ['09:06','09:07','09:08','09:09','09:10','09:11','09:12','09:13','09:14','09:15','09:16','09:17','09:18','09:19','09:20'], start: '09:21' }, tradeDates);
  // 60天：白天用15m精确，晚间/早段用日线近似（基准=当日开盘）
  const w60 = {};
  for (const d of daily.slice(-60)) {
    if (w30[d.date]) {
      const r = w30[d.date];
      w60[d.date] = { gran: '15m(精确)', baseline: r.baseline, dipN: r.dips.n, dipMax: r.dips.max, dipAvg: r.dips.avg, spikeN: r.spikes.n, spikeMax: r.spikes.max, spikeAvg: r.spikes.avg, total: r.dips.n + r.spikes.n };
    } else {
      const dipDepth = d.low < d.open ? +(((d.open - d.low) / d.open) * 100).toFixed(2) : 0;
      const spkDepth = d.high > d.open ? +(((d.high - d.open) / d.open) * 100).toFixed(2) : 0;
      w60[d.date] = { gran: '日线近似', baseline: +d.open.toFixed(1), dipN: d.low < d.open ? 1 : 0, dipMax: dipDepth, dipAvg: dipDepth, spikeN: d.high > d.open ? 1 : 0, spikeMax: spkDepth, spikeAvg: spkDepth, total: (d.low < d.open ? 1 : 0) + (d.high > d.open ? 1 : 0) };
    }
  }
  const sum7 = winSummary(w7, last7), sum30 = winSummary(w30, last30);
  return { tradeDates, last7, last30, last60, w7, w30, w1, w60, sum7, sum30, thresholdPct: DIPSPIKE.thresholdPct };
}
