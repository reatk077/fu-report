// 把项目推送到 GitHub（git data API：blob->tree->commit->ref，支持新增与更新）。读 GITHUB_TOKEN，绝不落盘。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const token = process.env.GITHUB_TOKEN;
if (!token) { console.error('NO_GITHUB_TOKEN'); process.exit(1); }
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const skip = new Set(['.git','node_modules','.vercel','.env','.env.local','snapshot.json','report.html']);
async function api(p, o={}) { const r = await fetch('https://api.github.com'+p, { ...o, headers: { Authorization:'Bearer '+token, 'User-Agent':'fu-report', 'Accept':'application/vnd.github+json', 'Content-Type':'application/json', ...(o.headers||{}) } }); const t=await r.text(); let j; try{ j=JSON.parse(t); }catch{ j=t; } if(!r.ok) throw new Error(p+' -> '+r.status+': '+String(typeof j==='string'?j:JSON.stringify(j)).slice(0,200)); return j; }
let user; try { user = await api('/user'); } catch(e){ console.error('AUTH:',e.message); process.exit(1); }
const repo = user.login + '/fu-report', branch='main';
function collect(dir, baseDir){ const out=[]; for(const e of fs.readdirSync(dir,{withFileTypes:true})){ const a=path.join(dir,e.name), rel=path.relative(baseDir,a).split(path.sep).join('/'); const base=path.basename(rel); if(skip.has(base)||e.name==='.vercel') continue; if(e.isDirectory()){ if(skip.has(e.name)) continue; out.push(...collect(a,baseDir)); } else { out.push(rel); } } return out; }
// 当前分支
const ref = await api('/repos/'+repo+'/git/ref/heads/'+branch).catch(()=>null);
let baseTree = null, parent = null;
if (ref) { const cm = await api('/repos/'+repo+'/git/commits/'+ref.object.sha); baseTree = cm.tree.sha; parent = ref.object.sha; }
const files = collect(root, root).sort();
const entries=[];
for (const f of files) { const data=fs.readFileSync(path.join(root,f)); const b=await api('/repos/'+repo+'/git/blobs',{method:'POST',body:JSON.stringify({content:data.toString('base64'),encoding:'base64'})}); entries.push({path:f, mode:'100644', type:'blob', sha:b.sha}); }
const tree = await api('/repos/'+repo+'/git/trees',{method:'POST',body:JSON.stringify({base_tree:baseTree, tree:entries})});
const commit = await api('/repos/'+repo+'/git/commits',{method:'POST',body:JSON.stringify({message:'sync: FU_Report 每日燃油期货信息汇总分析', tree:tree.sha, parents: parent?[parent]:[], author:{name:user.login,email:user.login+'@users.noreply.github.com'}, committer:{name:user.login,email:user.login+'@users.noreply.github.com'}})});
await api('/repos/'+repo+'/git/refs/heads/'+branch,{method:'PATCH',body:JSON.stringify({sha:commit.sha,force:false})});
console.log('PUSHED '+files.length+' files | '+repo+' | commit '+commit.sha.slice(0,7));
