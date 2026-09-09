// 可选部署：读 VERCEL_TOKEN 用 Vercel REST API 上传部署（项目已存在则复用）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const token = process.env.VERCEL_TOKEN;
if (!token) { console.error('NO_VERCEL_TOKEN'); process.exit(1); }
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PROJECT = 'fu-report';
const SKIP = new Set(['.git', 'node_modules', '.vercel', '.env', '.env.local']);
function collect(dir, base) { const out = []; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === '.vercel' || SKIP.has(e.name)) continue; const a = path.join(dir, e.name), rel = path.relative(base, a).split(path.sep).join('/'); if (e.isDirectory()) out.push(...collect(a, base)); else out.push({ file: rel, data: fs.readFileSync(a).toString('base64'), encoding: 'base64' }); } return out; }
async function api(p, o = {}) { const r = await fetch('https://api.vercel.com' + p, { ...o, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(o.headers || {}) } }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; } if (!r.ok) throw new Error(p + ' -> ' + r.status + ': ' + JSON.stringify(j).slice(0, 400)); return j; }
try { await api('/v9/projects', { method: 'POST', body: JSON.stringify({ name: PROJECT }) }); console.log('PROJECT_CREATED'); } catch (e) { if (/already exists/i.test(e.message)) console.log('PROJECT_EXISTS'); else throw e; }
const files = collect(root, root);
console.log('FILES=' + files.length + ' ' + Math.round(files.reduce((s, f) => s + f.data.length, 0) / 1024) + 'KB');
const dep2 = await api('/v13/deployments', { method: 'POST', body: JSON.stringify({ name: PROJECT, target: 'production', files, projectSettings: { framework: null, buildCommand: null, outputDirectory: null, installCommand: null, devCommand: null } }) });
const id = dep2.id; console.log('DEPLOYMENT=' + id + ' url=' + dep2.url + ' state=' + dep2.readyState);
let st = dep2.readyState, last = dep2;
for (let i = 0; i < 60 && !['READY','ERROR','CANCELED'].includes(st); i++) { await new Promise(r => setTimeout(r, 5000)); last = await api('/v13/deployments/' + id); st = last.readyState; console.log('poll[' + i + '] ' + st + (last.errorCode ? ' err=' + last.errorCode : '')); }
console.log('FINAL=' + JSON.stringify({ url: last.url, readyState: last.readyState, errorCode: last.errorCode || null }));
