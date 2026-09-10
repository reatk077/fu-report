# 定时方案（免费）

## 方案 A（推荐，已启用）：GitHub Actions
仓库 `.github/workflows/refresh.yml` 已配置三个计划任务，每天北京时间 **08:45 / 12:45 / 20:45** 请求 `GET https://fu-report.vercel.app/api/refresh`。
- 推送该文件后 GitHub Actions 自动注册计划任务（公开仓库免费）。
- 手动触发：Actions → daily-fu-refresh → Run workflow。

## 方案 B（可选）：cron-job.org 导入
登录 https://cron-job.org → Jobs → Create → 填三项（或 Import）：
| Job | URL | 时间(Cron, UTC) | 含义 |
|---|---|---|---|
| 早 | `https://fu-report.vercel.app/api/refresh` | `00 45 * * *` | 08:45 北京 |
| 午 | `https://fu-report.vercel.app/api/refresh` | `45 4 * * *` | 12:45 北京 |
| 晚 | `https://fu-report.vercel.app/api/refresh` | `45 12 * * *` | 20:45 北京 |
> cron-job.org 直接用上海/Asia 时区亦可，等价为 08:45 / 12:45 / 20:45。
> cron-job.org 支持「从 JSON 批量导入」，以上三项可作为 JSON 字段（url/on/schedule）。

## 说明
- `/api/refresh` 会实时抓取+量化分析+（若有 AI 密钥）AI 生成综合解读，返回 200 即成功，可重复调用、幂等。
- Vercel 免费版 Cron 每天最多 1 次，因此 3 时点建议用上面两种免费外部调度（或升级 Vercel Pro 用 Cron）。
