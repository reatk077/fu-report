// 编排：抓取 → 量化分析 → 风险情报 → AI/规则解读 → 组装报告
import { realtimeQuotes, dailyKline, minuteKline, intlDaily, nfQuotes } from './sina.js';
import { face } from './indicators.js';
import { spreads } from './crack.js';
import { dipspike } from './dipspike.js';
import { eventIntel } from './eventintel.js';
import { narrative, positionAdvice } from './narrative.js';
import { SYMBOLS, BARRELS_PER_TONNE, DEFAULT_REPORT_FRAME, fuContractCodes } from './constants.js';

const safe = async (p) => { try { return await p; } catch (e) { return null; } };
const r2 = v => v == null || isNaN(v) ? null : +v;

// 北京时间 now
function bjNow() {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
}
function bjDate() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }

// 按对齐日期生成价差序列
function alignSeries(datesOfA, datesOfB, ca, cb) {
  const mapB = new Map(datesOfB.map((d, i) => [d, cb[i]]));
  const out = [];
  for (let i = 0; i < datesOfA.length; i++) {
    const d = datesOfA[i]; if (mapB.has(d)) out.push({ date: d, a: ca[i], b: mapB.get(d) });
  }
  return out;
}

export async function run({ position, positions } = {}) {
  const posList = (positions && positions.length) ? positions : (position ? [position] : []);
  const t0 = Date.now();
  const [quotes, fuDaily, scDaily, luDaily, brentDaily, wtiDaily, min5, min15, min1, nf] = await Promise.all([
    safe(realtimeQuotes()),
    safe(dailyKline('FU0')), safe(dailyKline('SC0')), safe(dailyKline('LU0')),
    safe(intlDaily('OIL')), safe(intlDaily('CL')),
    safe(minuteKline('FU0', 5)), safe(minuteKline('FU0', 15)), safe(minuteKline('FU0', 1)),
    safe(nfQuotes(fuContractCodes(12))),
  ]);
  const today = bjDate();
  const lastDate = fuDaily && fuDaily.length ? fuDaily[fuDaily.length - 1].date : '';
  const marketStatus = lastDate === today ? '交易日·盘中/收盘' : (lastDate && lastDate < today ? '休市（最近交易日 ' + lastDate + '）' : '数据待更新');
  const quoteTime = quotes?.FU0?.time || '';
  const dataCutoff = quoteTime && quoteTime.length === 6 ? quoteTime.slice(0, 2) + ':' + quoteTime.slice(2, 4) + ':' + quoteTime.slice(4) : '';

  // 技术面 / 价差
  const trend = {
    fu: fuDaily ? face(fuDaily) : null,
    sc: scDaily ? face(scDaily) : null,
    lu: luDaily ? face(luDaily) : null,
  };
  const sp = quotes ? spreads(quotes) : null;

  // 日内下探/上探
  const ds = (fuDaily && min5) ? dipspike({ daily: fuDaily, min5, min15, min1 }) : null;

  // 资讯 + 霍尔木兹风险
  const events = quotes ? await eventIntel({ quotes }) : { news: [], sourcesUsed: [], risk: { score: 0, level: { key: 'green', label: '绿色 · 平静' }, items: [] } };

  // 报告主体
  const report = {
    meta: {
      generatedAt: bjNow(), tz: 'Asia/Shanghai', dataCutoff, marketStatus,
      sources: ['新浪期货(实时/日线/分钟)', '荷兰外盘CL/OIL', '东方财富(交叉)', '金十/同花顺/新浪/东财快讯', 'WSJ/IRNA/GCaptain'],
      disclaimer: '数据来自公开免费源，可能含缺失延迟；分析仅供参考，不构成投资建议。', timeCostMs: Date.now() - t0,
    },
    quotes: (() => { const o = {}; for (const [k, cfg] of Object.entries(SYMBOLS)) { const q = quotes?.[cfg.sina]; if (q) { const eq = { ...q, label: cfg.label, group: cfg.group }; if (eq.open && eq.prevSettle) eq.overnightPct = +((eq.open / eq.prevSettle - 1) * 100).toFixed(2); if (eq.latest && eq.open) eq.intradayPct = +((eq.latest / eq.open - 1) * 100).toFixed(2); o[k] = eq; } } return o; })(),
    trend, spreads: sp,
    dipspike: ds ? { thresholdPct: ds.thresholdPct, sum7: ds.sum7, sum30: ds.sum30, w7: ds.w7, w30: ds.w30, w60: ds.w60, last7: ds.last7, last30: ds.last30, last60: ds.last60 } : null,
    charts: {
      fu: fuDaily ? fuDaily.slice(-60).map(d => ({ date: d.date, close: d.close, changePct: r2((d.close / (prevClose(fuDaily, d)) - 1) * 100) })) : [],
      sc: scDaily ? scDaily.slice(-60).map(d => ({ date: d.date, close: d.close })) : [],
      lu: luDaily ? luDaily.slice(-60).map(d => ({ date: d.date, close: d.close })) : [],
      brent: brentDaily ? brentDaily.slice(-30).map(d => ({ date: d.date, close: d.close })) : [],
      wti: wtiDaily ? wtiDaily.slice(-30).map(d => ({ date: d.date, close: d.close })) : [],
      intraday: min5 ? min5.slice(-100).map(b => ({ time: b.d, close: b.close })) : [],
      spreads: [], // 下面填充
    },
    risk: { hormuz: events.risk },
    term: termStructure(nf),
    news: events.news, newsSources: events.sourcesUsed,
    narrative: { ai: false, title: '', paragraphs: [], recommendation: '' },
    position: null,
  };
  // 价差序列（对齐日期）
  if (fuDaily && scDaily) {
    const fz = fuDaily.slice(-60), sz = scDaily.slice(-60);
    const rows = alignSeries(fz.map(d => d.date), sz.map(d => d.date), fz.map(d => d.close), sz.map(d => d.close));
    report.charts.spreads = rows.map(r => ({ date: r.date, crackFU: +((r.a - r.b * BARRELS_PER_TONNE)).toFixed(0) }));
  }
  // 叙事 + 持仓
  report.narrative = await narrative(report, posList);
  report.positions = report.positions || [];
  if (!report.position) report.position = report.positions[0] || null;

  return report;
}
function termStructure(nf) {
  if (!nf) return null;
  const codes = Object.keys(nf).sort();
  const curve = codes.map(c => ({ code: c, month: c.slice(2), price: nf[c].latest, vol: nf[c].vol, hold: nf[c].hold })).filter(x => x.price > 0);
  // 用持仓量最高者视为主力
  const main = Object.entries(nf).sort((a, b) => b[1].hold - a[1].hold)[0];
  const mainCode = main ? main[0] : null;
  const mainPrice = main ? main[1].latest : (curve[0] && curve[0].price) || null;
  // 剔除临近交割月/异常值
  const keep = curve.filter(x => !mainPrice || (x.price < mainPrice * 1.3 && x.price > mainPrice * 0.5));
  keep.sort((a, b) => a.code.localeCompare(b.code));
  if (keep.length < 3) return { curve, mainCode, note: '期限结构数据不完整' };
  const first = keep[0].price, last = keep[keep.length - 1].price;
  const direction = first > last ? 'Backwardation(近高远低/现货升水)' : 'Contango(近低远高/期货升水)';
  return { curve: keep, mainCode, mainMonth: mainCode ? mainCode.slice(2) : null, direction, nearFarSpread: +(first - last).toFixed(0), near: first, far: last, note: '临近交割月价格可能失真，已剔除异常值' };
}

function prevClose(daily, d) { const i = daily.findIndex(x => x.date === d.date); return i > 0 ? daily[i - 1].close : d.open; }

export { bjNow, bjDate };
