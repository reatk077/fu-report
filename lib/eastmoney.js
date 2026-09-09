// 东方财富：具体合约日线（含成交额），用于交叉校验与更长历史
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', Referer: 'https://quote.eastmoney.com/' };
async function get(url, tries = 4) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
      const j = await r.json();
      if (j.rc !== 0 || !j.data) throw new Error('bad rc=' + j.rc);
      return j.data;
    } catch (e) {
      if (i === tries) throw e;
      await new Promise(res => setTimeout(res, 2000 * i));
    }
  }
}
// secid 113.fu2610 : 中金所/上期所 交易所代码 113=SHFE；具体合约
export async function specificDaily(secid) {
  const d = await get('https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + secid + '&fields1=f1,f2,f3&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=101&fqt=0&beg=20250101&end=20991231');
  return {
    name: d.name, code: d.code,
    klines: d.klines.map(k => { const p = k.split(','); return { date: p[0], open: +p[1], close: +p[2], high: +p[3], low: +p[4], vol: +p[5], amount: +p[6], changePct: +p[7] }; }),
  };
}
