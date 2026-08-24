// 极简 Rate Limiter（基于函数实例内存）
import { getHeader, getClientIp } from "./_headers.js";
// 注意：Vercel Functions 是无状态的，跨实例内存不共享
// 但每个实例内有效（可挡掉大部分自动化攻击）

const limits = {
  submit: { max: 100, windowMs: 24 * 60 * 60 * 1000 },  // 每天 100 次
  delete: { max: 50, windowMs: 60 * 60 * 1000 },        // 每小时 50 次
  clear:  { max: 5,  windowMs: 60 * 60 * 1000 }         // 每小时 5 次
};

const buckets = new Map();

function cleanOld(arr, windowMs) {
  const now = Date.now();
  while (arr.length && arr[0] < now - windowMs) arr.shift();
}

function getKey(action, ip) { return `${action}:${ip}`; }

export function getIp(req) {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = getHeader(req, 'x-real-ip');
  if (real) return real;
  return 'unknown';
}

export function check(action, req) {
  const cfg = limits[action];
  if (!cfg) return { ok: true };
  const ip = getIp(req);
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
