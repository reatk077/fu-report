// 资讯聚合 + 霍尔木兹风险情报
import { NEWS_SOURCES, EVENT_CATEGORIES, SENTIMENT_RULES, riskLevel } from './constants.js';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };

const TOPIC = new Set([
  '原油','油价','石油','燃料油','燃油','船燃','低硫','高硫','布伦特','美油','WTI','汽油','柴油','原油进口','原油期货','OPEC','欧佩克','能源','天然气','炼油','成品油','库欣','cushing','crude','oil','brent','wti','gas','opec','petroleum','fuel','diesel','gasoline','refiner','shipping','tanker','hormuz','strait','iran','sanction','tariff','特朗普','白宫','美国','俄罗斯','地缘'
].map(k => k.toLowerCase()));;

function clean(s) { return (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
function firstLine(s) { const m = clean(s).match(/^【([^】]+)】/); return m ? m[0] : ''; }
function unixToStr(ts) { if (!ts) return ''; const d = new Date((+ts) * 1000); return isNaN(d) ? '' : [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') + ' ' + [String(d.getHours()).padStart(2,'0'), String(d.getMinutes()).padStart(2,'0')].join(':'); }
const stripTs = t => (t || '').replace(/^\d{4}-\d{2}-\d{2}\s?/, '');

async function getText(url, headers = {}) {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(18000) });
  return await r.text();
}

// ---- 各源解析 ----
function parseJin10(j) {
  if (!j || j.status !== 200 || !j.data) return [];
  const out = [];
  for (const it of (j.data || [])) {
    const dd = it.data || {}; const c = dd.content || '';
    if (it.exclusive_to && it.exclusive_to.includes('vip')) continue;
    if (!c) continue;
    out.push({ title: dd.title || firstLine(c) || c.slice(0, 24), content: clean(c), time: it.time || '', url: '', source: '金十数据' });
  }
  return out;
}
function parseThs(j) {
  const list = j?.data?.list || [];
  return list.map(x => ({ title: clean(x.title), content: clean(x.digest), time: unixToStr(x.ctime), url: x.url || '', source: '同花顺' }));
}
function parseSina(j) {
  const list = j?.result?.data || [];
  return list.map(x => ({ title: clean(x.title), content: clean(x.intro), time: unixToStr(x.ctime), url: x.url || '', source: '新浪财经' }));
}
function parseEm(j) {
  const list = j?.data?.fastNewsList || [];
  return list.map(x => ({ title: clean(x.title || x.summary), content: clean(x.summary || x.title), time: x.showTime || '', url: x.url || '', source: '东方财富' }));
}
function parseRss(txt, include) {
  const out = [];
  const items = txt.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const it of items) {
    const title = clean((it.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)||[])[1]);
    const desc = clean((it.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)||[])[1]);
    const link = clean((it.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/)||[])[1]);
    const pub = clean((it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)||[])[1]);
    const text = (title + ' ' + desc).toLowerCase();
    const hay = new Set(['hormuz','strait of hormuz','oil','iran','crude','sanction','tanker','trump','brent','wti','middle east','gas','opec']);
    const rel = [...hay].some(k => text.includes(k));
    if (include && !rel) continue;
    if (!title && !desc) continue;
    out.push({ title, content: desc, time: '', url: link || '', source: 'rss' });
  }
  return out;
}

// ---- 分类/方向 ----
function classify(item) {
  const text = ((item.title || '') + ' ' + (item.content || '')).toLowerCase();
  const cats = [];
  for (const c of EVENT_CATEGORIES) { if (c.kws.some(k => text.includes(k.toLowerCase()))) cats.push(c.id); }
  let sent = '';
  for (const sr of SENTIMENT_RULES) { if (sr.kws.some(k => text.includes(k.toLowerCase()))) { sent = sr.tag; break; } }
  return { cats, sent };
}

export async function fetchNews({ limit = 25 } = {}) {
  const sources = ['jin10','ths','sina','em','wsj','wsjw','irna','gcaptain'];
  const items = [];
  const used = [];
  await Promise.all(sources.map(async (name) => {
    const cfg = NEWS_SOURCES[name];
    try {
      const txt = await getText(cfg.url, cfg.headers || {});
      let arr;
      if (cfg.parse === 'jin10') arr = parseJin10(JSON.parse(txt));
      else if (cfg.parse === 'ths') arr = parseThs(JSON.parse(txt));
      else if (cfg.parse === 'sina') arr = parseSina(JSON.parse(txt));
      else if (cfg.parse === 'em') arr = parseEm(JSON.parse(txt));
      else if (cfg.parse === 'rss') arr = parseRss(txt, cfg.rssInclude);
      else arr = [];
      for (const a of arr) {
        const text = ((a.title||'') + ' ' + (a.content||'')).toLowerCase();
        if (![...TOPIC].some(k => text.includes(k))) continue;   // 相关性过滤
        a.source = a.source || cfg.label; a.url = a.url || '';
        const cl = classify(a);
        a.cats = cl.cats; a.sentiment = cl.sent;
        items.push(a);
      }
      used.push(cfg.label);
    } catch (e) { /* 源失败 → 跳过，不阻塞 */ }
  }));
  // 去重（同标题）
  const seen = new Set(); const dedup = [];
  for (const it of items) { const k = it.title.toLowerCase(); if (seen.has(k)) continue; seen.add(k); dedup.push(it); }
  return { items: dedup.slice(0, limit), sourcesUsed: used };
}

function riskOf(items, quotes) {
  const HZ = new Set(['hormuz','tanker','iran','us']);  // 高危类
  const hzItems = [];
  let hzCount = 0, opecCount = 0;
  for (const it of items) {
    const isHZ = it.cats.some(c => HZ.has(c));
    if (isHZ) { hzCount++; hzItems.push(it); }
    if (it.cats.includes('opec') || it.cats.includes('china')) opecCount++;
  }
  let score = Math.min(55, hzCount * 6) + Math.min(10, opecCount * 2);
  const brent = quotes.OIL, fu = quotes.FU0;
  const mrk = (brent && brent.changePct >= 3 ? 12 : brent && brent.changePct >= 1.5 ? 8 : brent && brent.changePct >= 0.5 ? 4 : 0)
            + (fu && fu.changePct >= 3 ? 10 : fu && fu.changePct >= 1.5 ? 6 : fu && fu.changePct >= 0.5 ? 3 : 0);
  score = Math.min(100, Math.round(score + mrk));
  const lvl = riskLevel(score);
  return { score, level: lvl, items: hzItems.slice(0, 15) };
}

export async function eventIntel({ quotes }) {
  const { items, sourcesUsed } = await fetchNews();
  const risk = riskOf(items, quotes || {});
  return { news: items, sourcesUsed, risk };
}
