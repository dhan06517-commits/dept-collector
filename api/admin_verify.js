// POST /api/admin-verify
// 验证管理员密码
// 入参：{ password }
// 鉴权：任何人（密码正确才返回 ok）

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const buckets = new Map();
const LIMIT = 5;
const WINDOW = 60 * 1000;

function rateCheck(ip) {
  const now = Date.now();
  const arr = buckets.get(ip) || [];
  while (arr.length && arr[0] < now - WINDOW) arr.shift();
  if (arr.length >= LIMIT) return false;
  arr.push(now);
  buckets.set(ip, arr);
  return true;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: '仅支持 POST' }),
      { status: 405, headers: corsHeaders }
    );
  }

  // Vercel Functions 默认 req.headers 是普通对象，用方括号访问
  const xff = (req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'])) || '';
  const ip = xff.split(',')[0]?.trim() || 'unknown';
  if (!rateCheck(ip)) {
    return new Response(
      JSON.stringify({ error: '尝试次数过多，请稍后再试' }),
      { status: 429, headers: corsHeaders }
    );
  }

  let payload;
  try { payload = await req.json(); } catch (e) {
    return new Response(
      JSON.stringify({ error: '请求体不是合法 JSON' }),
      { status: 400, headers: corsHeaders }
    );
  }
  const { password } = payload;

  if (!password) {
    return new Response(
      JSON.stringify({ error: '缺少密码' }),
      { status: 400, headers: corsHeaders }
    );
  }
  if (!ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '管理员密码未配置（Vercel 后台缺少 ADMIN_PASSWORD 环境变量）' }),
      { status: 503, headers: corsHeaders }
    );
  }
  if (password !== ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ ok: false, error: '密码错误' }),
      { status: 401, headers: corsHeaders }
    );
  }
  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: corsHeaders }
  );
}
