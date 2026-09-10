// 更新时间点：北京 08:45 / 12:45 / 20:45  => UTC 00:45 / 04:45 / 12:45
export const REFRESH_SLOTS_UTC_MIN = [45, 285, 765];
export function lastSlotUTC(now = Date.now()) {
  const d = new Date(now);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  let last = null;
  for (const m of REFRESH_SLOTS_UTC_MIN) { const t = dayStart + m * 60000; if (t <= now) last = t; }
  if (last == null) last = dayStart - 86400000 + REFRESH_SLOTS_UTC_MIN[REFRESH_SLOTS_UTC_MIN.length - 1] * 60000;
  return last;
}
export function nextSlotUTC(now = Date.now()) {
  const d = new Date(now);
  const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  for (const m of REFRESH_SLOTS_UTC_MIN) { const t = dayStart + m * 60000; if (t > now) return t; }
  return dayStart + 86400000 + REFRESH_SLOTS_UTC_MIN[0] * 60000;
}
