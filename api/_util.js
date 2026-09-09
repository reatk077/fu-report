// api 共用小工具
export function parsePosition(req) {
  // body (POST) 或 query (GET)
  const src = req.body || {};
  const q = new URL(req.url, 'http://x').searchParams;
  const entry = src.entry ?? q.get('entry');
  const direction = src.direction ?? q.get('direction');
  const qty = src.qty ?? q.get('qty');
  const date = src.date ?? q.get('date');
  if (entry == null || entry === '' || isNaN(+entry)) return null;
  return { entry: +entry, direction: (direction || 'long') === 'short' ? 'short' : 'long', qty: qty ? +qty : 1, date };
}
