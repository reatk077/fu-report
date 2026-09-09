// 新浪期货数据抓取与解析（免密钥）
import { SYMBOLS } from './constants.js';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36' };

async function fetchText(url, extraHeaders = {}, tries = 4, ms = 20000) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { ...UA, ...extraHeaders },
        signal: AbortSignal.timeout(ms),
      });
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.text();
    } catch (e) {
      lastErr = e;
      if (i === tries) throw e;
      await new Promise(res => setTimeout(res, 1500 * i));
    }
  }
  throw lastErr;
}

// 解析新浪 jsonp：/*...*/ var t=([...]);  -> 数组（用括号定位，避免正则转义）
export function unwrapJsonp(text) {
  const s = text.indexOf('(');
  const e = text.lastIndexOf(')');
  if (s < 0 || e <= s) throw new Error('jsonp parse failed: ' + text.slice(0, 80));
  const inner = text.slice(s + 1, e).trim(); // 得到 [...] （含括号）
  if (!inner || inner[0] !== '[') throw new Error('jsonp no array: ' + text.slice(0, 80));
  return JSON.parse(inner);
}

// 实时行情（GBK 里数字为 ASCII，按逗号切分读数字字段即可；不依赖中文名解码）
export async function realtimeQuotes() {
  const symbols = ['nf_FU0','nf_SC0','nf_LU0','hf_CL','hf_OIL'].join(',');
  const text = await fetchText('https://hq.sinajs.cn/list=' + symbols, { Referer: 'https://finance.sina.com.cn' });
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/var hq_str_(\w+)="([^"]*)"/);
    if (!m) continue;
    const key = m[1], f = m[2].split(',');
    if (key.startsWith('nf_')) {
      out[key.slice(3)] = {
        symbol: key.slice(3), latest: +f[8] || 0, open: +f[2] || 0, high: +f[3] || 0, low: +f[4] || 0,
        prevSettle: +f[10] || 0, hold: +f[13] || 0, vol: +f[14] || 0, time: f[1] || '',
      };
    } else if (key.startsWith('hf_')) {
      out[key.slice(3)] = {
        symbol: key.slice(3), latest: +f[0] || 0, high: +f[4] || 0, low: +f[5] || 0,
        prevSettle: +f[7] || 0, open: +f[8] || 0, time: f[6] || '',
      };
    }
  }
  for (const k of Object.keys(out)) {
    const q = out[k];
    q.changePct = q.prevSettle ? +((q.latest / q.prevSettle - 1) * 100).toFixed(2) : 0;
  }
  return out;
}

// 批量国内合约实时行情 nf_（用于期限结构）
export async function nfQuotes(codes = []) {
  if (!codes.length) return {};
  const text = await fetchText('https://hq.sinajs.cn/list=nf_' + codes.join(',nf_'), { Referer: 'https://finance.sina.com.cn' });
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/var hq_str_nf_(\w+)="([^"]*)"/); if (!m) continue;
    const f = m[2].split(',');
    out[m[1]] = { symbol: m[1], latest: +f[8] || 0, open: +f[2] || 0, prevSettle: +f[10] || 0, hold: +f[13] || 0, vol: +f[14] || 0 };
  }
  return out;
}

// 国内主力日K线 -> [{date,open,high,low,close,vol,pos,settle}]
export async function dailyKline(symbol) {
  const u = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/InnerFuturesNewService.getDailyKLine?symbol=' + symbol;
  const t = await fetchText(u, { Referer: 'https://finance.sina.com.cn' });
  const arr = unwrapJsonp(t);
  return arr.map(r => ({
    date: String(r.d).slice(0, 10), open: +r.o, high: +r.h, low: +r.l, close: +r.c,
    vol: +r.v || 0, pos: +r.p || 0, settle: +r.s || 0,
  }));
}

// 国内分钟K线 -> [{d,date,time,open,high,low,close,vol}]
export async function minuteKline(symbol, type) {
  const u = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/InnerFuturesNewService.getFewMinLine?symbol=' + symbol + '&type=' + type;
  const t = await fetchText(u, { Referer: 'https://finance.sina.com.cn' });
  const arr = unwrapJsonp(t);
  return arr.map(r => ({
    d: String(r.d), date: String(r.d).slice(0, 10), time: String(r.d).slice(11, 16),
    open: +r.o, high: +r.h, low: +r.l, close: +r.c, vol: +r.v || 0,
  }));
}

// 国际原油日K线 -> [{date,open,high,low,close,vol}]
export async function intlDaily(symbol) {
  const u = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php/var%20t=/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=' + symbol;
  const t = await fetchText(u, { Referer: 'https://finance.sina.com.cn' });
  const arr = unwrapJsonp(t);
  return arr.map(r => ({ date: String(r.date).slice(0, 10), open: +r.open, high: +r.high, low: +r.low, close: +r.close, vol: +r.volume || 0 }));
}
