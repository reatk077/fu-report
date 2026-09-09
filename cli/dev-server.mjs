// 本地预览：node cli/dev-server.mjs [port]  -> 打开 http://localhost:3100
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { run } from '../lib/pipeline.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = +(process.env.PORT || 3100);
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml' };
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/data' || u.pathname === '/api/refresh') {
    try { const report = await run({}); res.writeHead(200, { 'Content-Type':'application/json', 'Cache-Control':'no-store' }); res.end(JSON.stringify(report)); }
    catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  if (u.pathname === '/api/health') { res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify({ ok:true })); return; }
  let p = u.pathname === '/' ? '/index.html' : u.pathname;
  const f = path.join(ROOT, 'public', p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log('dev server http://localhost:' + PORT));
