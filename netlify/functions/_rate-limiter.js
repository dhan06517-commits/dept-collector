// 极简 Rate Limiter（基于函数实例内存）
// 生产建议：Netlify Blobs / Upstash Redis / Cloudflare KV
// 但我们 Netlify Blobs 装不上 → 用内存 Map（重启会丢，但 Netlify Functions 复用实例）

const limits = {
  submit: { max: 100, windowMs: 24 * 60 * 60 * 1000 },  // 每天 100 次
  delete: { max: 50, windowMs: 60 * 60 * 1000 },        // 每小时 50 次
  clear:  { max: 5,  windowMs: 60 * 60 * 1000 }         // 每小时 5 次
};

const buckets = new Map(); // key: `${action}:${ip}` → [{ts}]

function cleanOld(arr, windowMs) {
  const now = Date.now();
  while (arr.length && arr[0] < now - windowMs) arr.shift();
}

function getKey(action, ip) { return `${action}:${ip}`; }

function getIp(event) {
  return event.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || event.headers['client-ip']
    || 'unknown';
}

function check(action, event) {
  const cfg = limits[action];
  if (!cfg) return { ok: true };
  const ip = getIp(event);
  const key = getKey(action, ip);
  if (!buckets.has(key)) buckets.set(key, []);
  const arr = buckets.get(key);
  cleanOld(arr, cfg.windowMs);
  if (arr.length >= cfg.max) {
    return {
      ok: false,
      retryAfter: Math.ceil((arr[0] + cfg.windowMs - Date.now()) / 1000)
    };
  }
  arr.push(Date.now());
  return { ok: true };
}

module.exports = { check, getIp };
