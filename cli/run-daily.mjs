// 本地运行：node --env-file=.env cli/run-daily.mjs [--html] [--pos '{"direction":"long","entry":3900,"qty":2}']
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { run } from '../lib/pipeline.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..');
const args = process.argv.slice(2);
function argVal(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
let position = null;
const posRaw = process.env.POSITION || argVal('--pos');
if (posRaw) { try { position = JSON.parse(posRaw); } catch { } }
const report = await run({ position });
const snap = path.join(OUT, 'snapshot.json');
fs.writeFileSync(snap, JSON.stringify(report, null, 2));
console.log('★ 已生成 snapshot.json | 耗时 ' + report.meta.timeCostMs + 'ms | ' + report.meta.generatedAt);
console.log('  市场状态:', report.meta.marketStatus, '| 数据截止:', report.meta.dataCutoff);
console.log('  FU:', report.quotes.fu?.latest, report.quotes.fu?.changePct + '%', '| SC:', report.quotes.sc?.latest, '| 布伦特:', report.quotes.brent?.latest);
console.log('  霍尔木兹:', report.risk.hormuz.level.label, '(评分', report.risk.hormuz.score + ')');
console.log('  标题:', report.narrative.title);
console.log('  ---- 分析摘要 ----');
for (const p of report.narrative.paragraphs) console.log('  •', p);
if (report.position) console.log('  持仓建议:', report.position.advice);
if (args.includes('--html')) {
  const { html } = await import('../lib/render.js').catch(() => ({ html: null }));
  if (html) fs.writeFileSync(path.join(OUT, 'report.html'), html(report));
}
