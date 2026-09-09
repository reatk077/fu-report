# FU_Report · 每日燃油期货信息汇总分析（Vercel）

以 **FU 燃料油主力**为核心，联动 **SC 原油 / LU 低硫燃料油 / Brent / WTI**，输出：价格与涨跌、量仓、裂解/高低硫价差、技术指标、日内下探/上探、**霍尔木兹海峡风险情报**、**AI 当日综合解读与预判**（含用户持仓的浮盈与操作建议）。

## 数据源（全部免密钥）
- 行情：新浪期货 `hq.sinajs.cn` / `InnerFuturesNewService`（FU0/SC0/LU0 主力+国际 CL/OIL）
- 日线/分钟：新浪（volume/position/settlement）
- 资讯：**金十数据**（主力）+同花顺+新浪+东财+WSJ+IRNA+GCaptain（best-effort）

## 定时更新
北京时间 08:45 / 12:45 / 20:45（= UTC 00:45 / 04:45 / 12:45）。
- **Vercel 免费版 Cron 每天最多 1 次**（vercel.json 已配 00:45 UTC 即 08:45）。
- 另外两个时点用**外部免费定时器**（推荐 cron-job.org，支持时区）定时 `GET https://<domain>/api/refresh`。

## 本地运行
```bash
# 抓取+分析+输出 snapshot JSON（可加 --html 生成静态报告）
node --env-file=.env cli/run-daily.mjs
node --env-file=.env cli/run-daily.mjs --html
```

## 部署到 Vercel
1. `vercel login` 或用 Git 连接项目。
2. 设置环境变量：`AI_API_KEY`（启用 AI 解读；任何 OpenAI 兼容 key）。
3. `vercel --prod`（或将本项目推 GitHub 自动部署）。

> 前端只读 `process.env.*`，密钥不会下发到浏览器。页面也支持本地 `.env`（gitignore）。

## 用户持仓
页面左侧/顶部有「我的持仓」输入（方向/购入价/手数/购入日期）。输入会随 `/api/data` 发送给服务端，纳入 AI 解读与「建议操作」计算（当前价 vs 购入价 → 浮盈浮亏，并结合趋势/关键位/霍尔木兹风险给出 持有/加仓/减仓/止损/止盈/观察 建议）。

## 结构
- `lib/`：抓取与分析（sina/eastmoney/indicators/crack/dipspike/eventintel/llm/narrative/pipeline）
- `api/`：`/api/data`、`/api/refresh`、`/api/health`
- `public/`：前端仪表盘
- `cli/`：本地运行入口
