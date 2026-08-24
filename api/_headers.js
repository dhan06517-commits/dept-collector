// Vercel Functions 兼容的 header 读取 helper
// Vercel 在不同 Node 版本下，req.headers 可能是 Map 或普通对象

export function getHeader(req, name) {
  const headers = req.headers;
  if (!headers) return '';
  if (typeof headers.get === 'function') {
    return headers.get(name) || headers.get(name.toLowerCase()) || '';
  }
  // 普通对象风格
  return headers[name] || headers[name.toLowerCase()] || '';
}

export function getClientIp(req) {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return getHeader(req, 'x-real-ip') || 'unknown';
}
