import { run } from '../lib/pipeline.js';
import { parsePosition } from './_util.js';
export default async function handler(req, res) {
  try {
    const report = await run({ position: parsePosition(req) });
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      ok: true, timeCostMs: report.meta.timeCostMs, generatedAt: report.meta.generatedAt,
      dataCutoff: report.meta.dataCutoff, marketStatus: report.meta.marketStatus,
      risk: report.risk.hormuz.level, riskScore: report.risk.hormuz.score,
      fu: report.quotes.fu, brent: report.quotes.brent,
      narrative: { ai: report.narrative.ai, title: report.narrative.title, recommendation: report.narrative.recommendation },
    });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
