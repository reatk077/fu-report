// 把项目推送到 GitHub（版本托管）。读 GITHUB_TOKEN，绝不落盘。用 contents API（对空仓库友好）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('NO_GITHUB_TOKEN'); process.exit(1); }
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skip = new Set(['.git','node_modules','.vercel','.env','.env.local','snapshot.json','report.html']);
async function api(p, o={}) { const r = await fetch('https://api.github.com'+p, { ...o, headers: { Authorization:'Bearer '+token, 'User-Agent':'fu-report', 'Accept':'application/vnd.github+json', 'Content-Type':'application/json', ...(o.headers||{}) } }); const t=await r.text(); let j; try{ j=JSON.parse(t); }catch{ j=t; } if(!r.ok) throw new Error(p+' -> '+r.status+': '+String(typeof j==='string'?j:JSON.stringify(j)).slice(0,300)); return j; }
let user; try { user = await api('/user'); } catch(e){ console.error('AUTH:',e.message); process.exit(1); }
const repo = user.login + '/fu-report';
const defaultBranch = 'main';
function collect(dir, baseDir){ const out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const a=path.join(dir,e.name), rel=path.relative(baseDir,a).split(path.sep).join('/'); const base=path.basename(rel); if(skip.has(base)||e.name==='.vercel') continue; if(e.isDirectory()){ if(skip.has(e.name)) continue; out.push(...collect(a,baseDir)); } else { out.push(rel); } } return out; }
const files = collect(root, root).sort();
let ok=0;
for (const f of files) {
  const data = fs.readFileSync(path.join(root, f));
  try {
    await api('/repos/'+repo+'/contents/'+f, { method:'PUT', body: JSON.stringify({ message:'add: '+f, content: data.toString('base64'), branch: defaultBranch }) });
    ok++;
  } catch(e){ console.error('skip '+f+': '+e.message.slice(0,120)); }
}
console.log('PUSHED '+ok+'/'+files.length+' files to '+repo);
