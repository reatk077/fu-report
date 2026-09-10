import { run } from '../lib/pipeline.js';
import { parsePositions } from './_util.js';
import { lastSlotUTC, nextSlotUTC } from '../lib/schedule.js';

// 模块级缓存：同一个 warm 实例内，同一时间片直接复用（不重算、不调 AI）
let CACHE = { ts: 0, key: '', report: null };

export default async function handler(req, res) {
  try {
    const q = new URL(req.url, 'http://x').searchParams;
    const positions = parsePositions(req);
    const key = JSON.stringify(positions);
    const force = q.get('refresh') === '1';
    const now = Date.now();
    const slot = lastSlotUTC(now);
    const fresh = CACHE.report && CACHE.key === key && CACHE.ts >= slot;
    // 允许 Vercel CDN 缓存 10 分钟，进一步降低函数/AI 调用
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    if (!force && fresh) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json({ ...CACHE.report, cache: { hit: true, ts: CACHE.ts, lastSlot: slot, nextSlot: nextSlotUTC(now) } });
    }
    const report = await run({ positions });
    CACHE = { ts: Date.now(), key, report };
    res.setHeader('X-Cache', 'MISS');
    res.status(200).json({ ...report, cache: { hit: false, ts: CACHE.ts, lastSlot: slot, nextSlot: nextSlotUTC(now) } });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
