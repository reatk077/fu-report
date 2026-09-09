// OpenAI 兼容客户端：密钥从 Vercel 环境变量读取，绝不写入文件/下发前端
export let lastAiError = null;
export async function chat(prompt, { system = '', temperature = 0.4, maxTokens = 900 } = {}) {
  const key = process.env.AI_API_KEY;
  if (!key) { lastAiError = 'AI_API_KEY 未设置'; return null; }
  const base = process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = process.env.AI_MODEL || 'gpt-4o-mini';
  try {
    const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, temperature, max_tokens: maxTokens, messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ] }),
      signal: AbortSignal.timeout(50000),
    });
    if (!r.ok) { lastAiError = 'AI 请求失败 http ' + r.status; return null; }
    const j = await r.json();
    const c = j?.choices?.[0]?.message?.content;
    if (!c) { lastAiError = 'AI 返回为空'; return null; }
    lastAiError = null; return c;
  } catch (e) { lastAiError = 'AI 网络/解析错误：' + (e.cause?.code || e.message); return null; }
}
