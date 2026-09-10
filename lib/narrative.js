// 文字解读：规则模板（无AI key 兜底） + AI 综合解读与预判；支持多笔持仓
import { chat, lastAiError } from './llm.js';
import { riskLevel } from './constants.js';

const pct = v => v == null || isNaN(v) ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(2) + '%';
const num = v => v == null || isNaN(v) ? '—' : (+v).toLocaleString('zh-CN');

// 单笔浮盈与操作建议（规则版）
export function positionAdvice(report, pos) {
  if (!pos || !pos.entry) return null;
  const fu = report.quotes?.fu;
  const latest = fu?.latest;
  if (!latest) return null;
  const dir = pos.direction === 'short' ? -1 : 1;
  const pnlPct = +(((latest - pos.entry) / pos.entry) * 100 * dir).toFixed(2);
  const pnlAmount = +((latest - pos.entry) * (pos.qty || 1) * 10 * dir).toFixed(0);  // FU 一手=10吨
  const t = report.trend?.fu;
  let advice = '观望';
  if (dir === 1) {
    if (pnlPct >= 5) advice = '浮盈可观：可持有/上移止损，若近压力位则分批止盈';
    else if (pnlPct >= 0) advice = '小幅浮盈：结合趋势与关键位持有，站稳支撑可续持，跌破则减仓';
    else if (pnlPct >= -3) advice = '小幅浮亏：关注支撑位，守住则持有，跌破止损';
    else advice = '浮亏较大：严格止损，观察形态与油价，避免抗单';
  } else {
    if (pnlPct >= 5) advice = '空单浮盈可观：可持有/上移止损，若见支撑则分批止盈';
    else if (pnlPct >= 0) advice = '空单小幅浮盈：持有，触及支撑注意止盈';
    else if (pnlPct >= -3) advice = '空单小幅浮亏：关注压力位，守稳则持有，升破止损';
    else advice = '空单浮亏较大：严格止损，防止逼空';
  }
  if (report.risk?.hormuz?.level?.key === 'red' || report.risk?.hormuz?.level?.key === 'orange') advice += '；【霍尔木兹风险偏高，警惕油价波动放大】';
  if (t?.rsi != null && t.rsi >= 70) advice += '；【RSI超买，提防回调】';
  if (t?.rsi != null && t.rsi <= 30) advice += '；【RSI超卖，或有修复反弹】';
  return { status: (dir === 1 ? '多' : '空') + '单', entry: pos.entry, direction: pos.direction, qty: pos.qty || 1, date: pos.date || '', latest, pnlPct, pnlAmount, advice };
}

// 多笔整体（规则版）
export function aggregateAdvice(report, items) {
  if (!items || !items.length) return null;
  const totalQty = items.reduce((s, x) => s + (x.qty || 0), 0);
  const totalPnl = items.reduce((s, x) => s + (x.pnlAmount || 0), 0);
  const avgPnl = +((items.reduce((s, x) => s + (x.pnlPct || 0), 0) / items.length)).toFixed(2);
  const risk = report.risk?.hormuz?.level?.key;
  let overall;
  if (risk === 'red' || risk === 'orange') overall = '地缘风险偏高：建议降杠杆/收紧止损，勿在波动放大时追单';
  else if (items.length === 1) overall = items[0].advice;
  else { const won = items.filter(x => x.pnlPct >= 0).length; overall = (won >= items.length - 1) ? '整体偏盈：分批止盈、上移止损' : '控制风险：优先处理亏损单，等待地缘与技术明朗再做决定'; }
  return { status: '总持仓', count: items.length, totalQty, totalPnl, avgPnl, overall, items };
}

// 规则模板解读（无 AI 时兜底）
export function rulesNarrative(report, items, agg) {
  const fu = report.quotes?.fu, sc = report.quotes?.sc, lu = report.quotes?.lu, brent = report.quotes?.brent, wti = report.quotes?.wti;
  const t = report.trend?.fu, sp = report.spreads, ds = report.dipspike;
  const rk = report.risk?.hormuz?.level || riskLevel(0);
  const p = [];
  p.push('FU燃料油主力（连续）现报 ' + num(fu?.latest) + ' 元/吨，' + pct(fu?.changePct) + '，成交 ' + num(fu?.vol) + ' 手，持仓 ' + num(fu?.hold) + ' 手；SC原油 ' + num(sc?.latest) + '（' + pct(sc?.changePct) + '）、LU低硫 ' + num(lu?.latest) + '（' + pct(lu?.changePct) + '），国际布伦特 ' + num(brent?.latest) + '（' + pct(brent?.changePct) + '）、WTI ' + num(wti?.latest) + '（' + pct(wti?.changePct) + '）。');
  if (t) p.push('技术面：' + t.direction + '；MA20 ' + num(t.ma20) + '，RSI(14) ' + num(t.rsi) + '(' + (t.rsiState || '中性') + ')，ATR ' + num(t.atr) + '，当日振幅 ' + pct(t.amplitude) + '；近20日区间 ' + t.low20 + '～' + t.high20 + '，现价处于区间 ' + t.pos20 + '% 分位，关键支撑 ' + t.support + ' / 压力 ' + t.resistance + '。');
  if (report.term) p.push('期限结构：' + report.term.direction + '；主力 ' + report.term.mainMonth + '（现报 ' + num((report.term.curve || []).find(c => c.month === report.term.mainMonth)?.price) + '），近月 ' + report.term.near + ' ~ 远月 ' + report.term.far + '，近-远月差 ' + report.term.nearFarSpread + ' 元/吨' + (report.term.note ? '（' + report.term.note + '）' : '') + '。');
  if (fu) p.push('夜盘/日盘：开盘(含夜盘)较昨结 ' + pct(fu.overnightPct) + '，最新较开盘 ' + pct(fu.intradayPct) + '（当日日内方向）。');
  p.push('价差结构：裂解价差 FU−SC ' + num(sp?.crackFU) + ' / LU−SC ' + num(sp?.crackLU) + '（元/吨），高低硫 LU−FU ' + num(sp?.lsSpread) + '（' + pct(sp?.lsSpread_pct) + '），布伦特−WTI ' + num(sp?.brentWti) + '。');
  if (ds) p.push('日内习性(日盘)：近7个交易日共下探 ' + ds.sum7?.dipN + ' 次 / 上探 ' + ds.sum7?.spikeN + ' 次（合计 ' + ds.sum7?.total + '，日均 ' + (ds.sum7?.days ? (ds.sum7.total / ds.sum7.days).toFixed(1) : '—') + '），下探均深 ' + ds.sum7?.dipAvgDepth + '%（最深 ' + ds.sum7?.dipMaxDepth + '%），上探均深 ' + ds.sum7?.spikeAvgDepth + '%（最深 ' + ds.sum7?.spikeMaxDepth + '%）；近30日合计 ' + ds.sum30?.total + ' 次。');
  p.push('霍尔木兹风险：' + rk.label + '（风险分 ' + report.risk?.hormuz?.score + '），相关快讯 ' + (report.risk?.hormuz?.items?.length || 0) + ' 条。');
  if (items && items.length) {
    if (items.length === 1) p.push('我的持仓：' + items[0].status + ' 购入价 ' + num(items[0].entry) + '，现价 ' + num(items[0].latest) + '，浮盈 ' + pct(items[0].pnlPct) + '，建议：' + items[0].advice);
    else p.push('我的持仓（' + items.length + ' 笔，合计 ' + agg.totalQty + ' 手）：' + items.map(x => x.status + '@' + num(x.entry) + '(' + pct(x.pnlPct) + ')').join('；') + '；整体浮盈 ' + pct(agg.avgPnl) + '，合计盈亏 ' + num(agg.totalPnl) + '。整体建议：' + agg.overall);
  }
  const title = 'FU主力 ' + pct(fu?.changePct) + ' · 技术' + (t ? t.direction : '—') + ' · 霍尔木兹' + (rk.label.split(' ')[0] || '');
  return { ai: false, title, paragraphs: p, recommendation: (agg && agg.overall) || '' };
}

// 收集给 AI 的证据字符串
function evidence(report, items, agg) {
  const q = report.quotes, t = report.trend?.fu, sp = report.spreads, ds = report.dipspike;
  const fmtQ = key => { const x = q[key]; return x ? (x.label + ' 最新 ' + num(x.latest) + ' 涨跌 ' + pct(x.changePct) + ' 量 ' + num(x.vol) + ' 仓 ' + num(x.hold)) : (key + ' 无数据'); };
  const L = [];
  L.push('行情实时快照：' + fmtQ('fu') + '；' + fmtQ('sc') + '；' + fmtQ('lu') + '；' + fmtQ('brent') + '；' + fmtQ('wti'));
  if (t) L.push('FU技术面：' + JSON.stringify({ direction: t.direction, ma5: t.ma5, ma10: t.ma10, ma20: t.ma20, rsi: t.rsi, rsiState: t.rsiState, atr: t.atr, amplitude: t.amplitude, pos20: t.pos20, support: t.support, resistance: t.resistance, cum20: t.cum20 }));
  if (sp) L.push('价差：' + JSON.stringify(sp));
  if (report.term) L.push('FU期限结构/月差：' + JSON.stringify({ direction: report.term.direction, nearFarSpread: report.term.nearFarSpread, mainMonth: report.term.mainMonth, curve: (report.term.curve || []).slice(0, 8).map(c => ({ m: c.month, p: c.price })) }));
  if (ds) L.push('日内下探/上探：近7日' + JSON.stringify({ dipN: ds.sum7?.dipN, spikeN: ds.sum7?.spikeN, total: ds.sum7?.total, dipAvg: ds.sum7?.dipAvgDepth, spikeAvg: ds.sum7?.spikeAvgDepth, dipMax: ds.sum7?.dipMaxDepth, spikeMax: ds.sum7?.spikeMaxDepth }));
  if (report.quotes.fu) L.push('FU 夜盘/日盘：开盘较昨结 ' + report.quotes.fu.overnightPct + '%，最新较开盘 ' + report.quotes.fu.intradayPct + '%');
  if (report.risk) L.push('霍尔木兹/风险：' + report.risk.hormuz.level.label + ' 分数 ' + report.risk.hormuz.score + '。相关事件：' + (report.risk.hormuz.items?.slice(0, 12).map(i => i.title || i.content).join(' | ') || '暂无'));
  if (report.news && report.news.length) L.push('今日快讯要点：' + report.news.slice(0, 15).map(n => (n.title || n.content).slice(0, 60)).join(' ；'));
  L.push('数据截止：' + report.meta.dataCutoff + '；市场状态：' + report.meta.marketStatus);
  if (items && items.length) L.push('用户持仓（' + items.length + ' 笔，合计 ' + agg.totalQty + ' 手，整体盈亏 ' + num(agg.totalPnl) + '）：' + items.map(x => x.status + ' 购入价 ' + x.entry + ' 手 ' + x.qty + ' 现价 ' + x.latest + ' 浮盈 ' + pct(x.pnlPct)).join('；') + '。请对每一笔给出具体操作建议（持有/加仓/减仓/止盈/止损/观望+理由+关键价位），并给出整体仓位建议。');
  return L.join('\n');
}

export async function aiNarrative(report, items, agg) {
  const ev = evidence(report, items, agg);
  const system = '你是国内能源化工期货分析师，擅长燃料油(FU)与原油(SC)联动、裂解/高低硫价差、技术面与地缘风险(尤其霍尔木兹海峡)解读。分析只做参考，需给出数据依据，并提示风险。';
  const prompt = '基于以下"当日当下"数据，输出一份结构化中文综合分析（约700字，条理清晰）：\n' +
    '【一、当日行情回顾】\n【二、解读(驱动: 原油 / 霍尔木兹风险 / 价差 / 技术)】\n【三、预判(短线方向 + 关键支撑压力 + 情景 + 风险)】\n【四、结论与操作(结合用户持仓——若有多笔请逐笔给出建议，并给整体仓位建议)】\n\n数据：\n' + ev;
  const raw = await chat(prompt, { system, temperature: 0.45, maxTokens: 1400 });
  if (!raw) return null;
  const paragraphs = raw.split(/\n{1,2}/).map(s => s.trim()).filter(Boolean);
  const title = (paragraphs[0] && paragraphs[0].replace(/^#+\s*/, '').slice(0, 30)) || 'AI 综合解读';
  return { ai: true, title, paragraphs, recommendation: (agg && agg.overall) || '' };
}

export async function narrative(report, posList) {
  const items = (posList || []).map(p => positionAdvice(report, p)).filter(Boolean);
  report.positions = items;
  const agg = aggregateAdvice(report, items);
  report.position = agg || null;
  report.aiDiagnostics = { hasKey: !!(process.env.AI_API_KEY), mode: '?', error: null };
  const ai = await aiNarrative(report, items, agg);
  report.aiDiagnostics = { hasKey: !!(process.env.AI_API_KEY), mode: ai ? 'ai' : 'rules', error: lastAiError || null };
  if (ai) return ai;
  return rulesNarrative(report, items, agg);
}
