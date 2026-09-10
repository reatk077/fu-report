// api 共用小工具
function normPos(p) {
  if (!p || p.entry == null || p.entry === '' || isNaN(+p.entry)) return null;
  return { entry: +p.entry, direction: (p.direction || 'long') === 'short' ? 'short' : 'long', qty: +p.qty || 1, date: p.date || '' };
}
// 优先解析多笔(positions JSON)，否则兼容旧的单笔(direction/entry/qty)
export function parsePositions(req) {
  const src = req.body || {};
  const q = new URL(req.url, 'http://x').searchParams;
  const posRaw = src.positions ?? q.get('positions');
  if (posRaw) { try { const arr = JSON.parse(posRaw); if (Array.isArray(arr)) return arr.map(normPos).filter(Boolean); } catch { } }
  const entry = src.entry ?? q.get('entry');
  const direction = src.direction ?? q.get('direction');
  const qty = src.qty ?? q.get('qty');
  const date = src.date ?? q.get('date');
  if (entry == null || entry === '' || isNaN(+entry)) return [];
  return [{ entry: +entry, direction: (direction || 'long') === 'short' ? 'short' : 'long', qty: qty ? +qty : 1, date }];
}
