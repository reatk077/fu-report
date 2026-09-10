import { run } from '../lib/pipeline.js';
import { parsePositions } from './_util.js';
export default async function handler(req, res) {
  const t0 = Date.now();
  try {
    const report = await run({ positions: parsePositions(req) });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(report);
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
