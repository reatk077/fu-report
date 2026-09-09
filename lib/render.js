// 由报告对象生成自包含静态 HTML（离线/分发用）
const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmt = v => v==null||isNaN(v)?'—':(+v).toLocaleString('zh-CN');
const pct = v => v==null||isNaN(v)?'—':(v>=0?'+':'')+(+v).toFixed(2)+'%';
export function html(r){
  const q=r.quotes||{}, m=r.meta||{}, rk=r.risk?.hormuz?.level||{label:'绿',color:'#22c55e'};
  const cards=[['fu','燃料油主力'],['sc','原油主力'],['lu','低硫燃料油'],['brent','布伦特'],['wti','WTI']].map(([k,l])=>{const x=q[k];return x?'<tr><td>'+l+'</td><td>'+fmt(x.latest)+'</td><td>'+pct(x.changePct)+'</td><td>'+fmt(x.vol)+'</td><td>'+fmt(x.hold)+'</td></tr>':'';}).join('');
  const narr=(r.narrative?.paragraphs||[]).map(p=>'<p>'+esc(p)+'</p>').join('');
  const news=(r.news||[]).map(n=>'<li>'+esc(n.title||n.content).slice(0,150)+' <span>['+esc(n.source)+' '+(n.time||'')+']</span></li>').join('');
  return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>FU_Report</title><style>body{font-family:-apple-system,Segoe UI,Microsoft YaHei,sans-serif;margin:20px;background:#0f141b;color:#e7edf5}table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid #2a3442;padding:6px 8px;text-align:right;font-size:13px}td.l{text-align:left}th{color:#93a1b3}h1{font-size:20px}.card{background:#1c242f;border:1px solid #2a3442;border-radius:8px;padding:12px;margin:8px 0}.risk{background:'+rk.color+'22;border:1px solid '+rk.color+';padding:10px 14px;border-radius:8px;font-weight:600}</style></head><body>'+
  '<h1>FU_Report · 每日燃油期货信息汇总</h1><p>'+esc(m.generatedAt)+' · '+'数据截止 '+esc(m.dataCutoff)+' · '+esc(m.marketStatus)+' · 来源: '+esc((m.sources||[]).join(', '))+'</p>'+
  '<div class="risk">霍尔木兹风险: '+rk.label+'（评分 '+r.risk.hormuz.score+'）</div>'+
  '<div class="card"><h2>实时快照</h2><table><tr><th class="l">品种</th><th>最新</th><th>涨跌</th><th>量</th><th>仓</th></tr>'+cards+'</table></div>'+
  '<div class="card"><h3>技术面</h3>'+(r.trend?.fu?'<p>'+esc(JSON.stringify(r.trend.fu))+'</p>':'' )+'</div>'+
  '<div class="card"><h3>价差</h3><p>'+esc(JSON.stringify(r.spreads||{}))+'</p></div>'+
  '<div class="card"><h3>日内下探/上探</h3><p>7日: '+esc(JSON.stringify(r.dipspike?.sum7||{}))+'</p></div>'+
  '<div class="card"><h2>AI/规则解读</h2>'+narr+'</div>'+
  (r.position?'<div class="card"><h3>持仓建议</h3><p>'+esc(r.position.advice)+'</p></div>':'')+
  '<div class="card"><h3>今日快讯</h3><ul>'+news+'</ul></div>'+
  '<p style="color:#93a1b3;font-size:12px">'+esc(m.disclaimer||'')+'</p></body></html>';
}
