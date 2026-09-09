// 全局常量：品种、换算、阈值、关键词、风险权重、来源
export const TZ = 'Asia/Shanghai';
export const UTC_OFFSET_PLUS8 = 8;
// 1 吨原油约 = 7.33 桶（SC 期货为元/桶）
export const BARRELS_PER_TONNE = 7.33;

export const SYMBOLS = {
  fu: { label: '燃料油主力', sina: 'FU0', group: 'domestic' },   // SHFE 燃料油
  sc: { label: '原油主力', sina: 'SC0', group: 'domestic' },     // INE 原油
  lu: { label: '低硫燃料油主力', sina: 'LU0', group: 'domestic' },// INE 低硫燃料油
  brent: { label: '布伦特原油', sina: 'OIL', group: 'intl' },     // 国际日线
  wti: { label: 'WTI原油', sina: 'CL', group: 'intl' },
};

// 日线/分钟线使用的整数合约代码（新浪 InnerFuturesNewService）
export const DAILY_SYMBOLS = { fu: 'FU0', sc: 'SC0', lu: 'LU0' };
export const INTL_DAILY = { brent: 'OIL', wti: 'CL' };

// 生成 FU 近 n 个月合约代码（基于当前北京时间的年月）
export function fuContractCodes(n = 12) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  let y = +(parts.find(p => p.type === 'year').value), m = +(parts.find(p => p.type === 'month').value);
  const out = [];
  for (let i = 0; i < n; i++) { out.push('FU' + String(y).slice(2, 4) + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
  return out;
}

// 日内"下探/上探"阈值与基准窗口
export const DIPSPIKE = {
  thresholdPct: 0.1,   // 相对基准的偏离阈值 %
  windows: {
    w7:  { gran: 5,  labels: ['09:10','09:15','09:20'], start: '09:25' },  // 5m 基准 09:10-09:20
    w30: { gran: 15, labels: ['09:30','09:45'],         start: '10:00' }, // 15m 基准 09:30-09:45
    w60daily: null, // 60天 用日线近似（基准=当日开盘）
  },
  daySession: { start: '09:00', end: '15:00' },
  nightStart: '21:00',
};

export const INDICATORS = { maArr: [5,10,20,60], atrPeriod: 14, rsiPeriod: 14, lookback20: 20, lookback60: 60 };

// 霍尔木兹/宏观事件关键词归类（用于资讯聚合与风险计分）
export const EVENT_CATEGORIES = [
  {
    id: 'hormuz', name: '霍尔木兹/海峡', weight: 5, risk: 'high',
    kws: ['霍尔木兹','霍尔木兹海峡','Hormuz','霍尔木兹湾','阿曼湾','曼德海峡','红海','波斯湾','波斯湾','杰里科','海峡'],
  },
  { id: 'tanker', name: '油轮/通行', weight: 5, risk: 'high',
    kws: ['油轮','tanker','油轮遇袭','油轮袭击','劫持','扣押','改道','绕行','护航','军舰','美国海军','第五舰队','海军','封锁','通行','过境','吃水','挂靠','unconventional'], },
  { id: 'iran', name: '伊朗', weight: 4, risk: 'high',
    kws: ['伊朗','伊朗核','革命卫队','IRGC','德黑兰','莱西','伊朗系','圣城旅','无人机','导弹','弹道','射击','演习','核谈判','铀','浓缩'], },
  { id: 'us', name: '美国/白宫', weight: 3, risk: 'medium',
    kws: ['特朗普','特朗普政府','白宫','美国国务院','布林肯','鲁比奥','美伊','美国','美国财政部','制裁','关税','油轮','舰队','五角大楼','国防部'], },
  { id: 'opec', name: 'OPEC/减产', weight: 3, risk: 'medium',
    kws: ['OPEC','欧佩克','减产','增产','原油日产量','沙特','俄罗斯','阿尔及利亚','伊拉克','哈萨克','阿联酋','页岩油','EIA','库存','库欣','累库','去库','交割'], },
  { id: 'china', name: '中国/国内', weight: 2, risk: 'low',
    kws: ['中国','国内','原油进口','炼厂','开工率','主营','地方炼厂','成品油','船燃','燃料油','低硫','高硫','舟山','保税','升水','贴水','国内'], },
];

// 每类关键词的"方向标签"（用于资讯标注，仅供参考）
export const SENTIMENT_RULES = [
  { tag: '利多', kws: ['刺激','增长','需求旺盛','去库','累库','减产','制裁','封锁','停摆','袭击','冲突','上调','涨价','供应中断','紧张','缺口','看涨'], },
  { tag: '利空', kws: ['增产','复产','需求疲软','累库','过剩','下调','降价','缓解','停火','谈判','达成','供应恢复','看跌','衰退'], },
];

// 资讯源（免密钥；金十为主力，其余 best-effort）
export const NEWS_SOURCES = {
  jin10: {
    label: '金十数据',
    url: 'https://flash-api.jin10.com/get_flash_list?max_time=&channel=-8200',
    headers: { 'x-app-id': 'bVBF4FyRTn5NJF5n', 'x-version': '1.0.0', Referer: 'https://www.jin10.com' },
    parse: 'jin10',
  },
  ths: {
    label: '同花顺',
    url: 'https://news.10jqka.com.cn/tapp/news/push/stock/',
    headers: { Referer: 'https://www.10jqka.com.cn' },
    parse: 'ths',
  },
  sina: {
    label: '新浪财经',
    url: 'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&num=40&page=1',
    headers: { Referer: 'https://finance.sina.com.cn' },
    parse: 'sina',
  },
  em: {
    label: '东方财富',
    url: 'https://np-listapi.eastmoney.com/comm/web/getFastNewsList?client=web&biz=web_fast&fastColumn=102&sortEnd=&pageSize=30&req_trace=',
    headers: { Referer: 'https://www.eastmoney.com' },
    parse: 'em',
  },
  wsj: {
    label: 'WSJ',
    url: 'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',
    headers: {},
    parse: 'rss', rssInclude: ['Hormuz','Strait of Hormuz','Oil','Iran','Trump','crude','sanctions','tanker'],
  },
  wsjw: {
    label: 'WSJ World',
    url: 'https://feeds.a.dj.com/rss/RSSWorldNews.xml',
    headers: {},
    parse: 'rss', rssInclude: ['Hormuz','Strait of Hormuz','Oil','Iran','Trump','crude','sanctions','tanker','Middle East'],
  },
  irna: {
    label: 'IRNA 伊朗',
    url: 'https://en.irna.ir/rss',
    headers: {},
    parse: 'rss',
  },
  gcaptain: {
    label: 'GCaptain 航运',
    url: 'https://gcaptain.com/feed/',
    headers: {},
    parse: 'rss',
  },
};

// 霍尔木兹风险等级映射分（返回 绿/黄/橙/红）
export function riskLevel(score) {
  if (score >= 65) return { key: 'red', label: '红色 · 高风险', color: '#d32f2f' };
  if (score >= 45) return { key: 'orange', label: '橙色 · 偏高', color: '#f57c00' };
  if (score >= 25) return { key: 'yellow', label: '黄色 · 关注', color: '#fbc02d' };
  return { key: 'green', label: '绿色 · 平静', color: '#2e7d32' };
}

export const DEFAULT_REPORT_FRAME = {
  days60: 60, days30: 30, days7: 7,
  intlDays: 30,
};
