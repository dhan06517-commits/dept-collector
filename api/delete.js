// POST /api/delete
import { getHeader, getClientIp } from "./_headers.js";
// 删除单条月报
// 鉴权：Basic Auth（管理员密码）

import { readDb, writeDb } from './_github.js';
import { check as rateCheck, getIp } from './_rate-limiter.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const checkAdmin = (req) => {
  const customPw = getHeader(req, 'x-admin-password');
  if (customPw && customPw === ADMIN_PASSWORD) return true;
  const auth = getHeader(req, 'authorization') || getHeader(req, 'Authorization');
  if (auth && auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i >= 0 && decoded.slice(i + 1) === ADMIN_PASSWORD) return true;
    } catch (_) {}
  }
  return false;
};

export async function POST(req) {
  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }),
      { status: 503, headers: corsHeaders }
    );
  }
  const rate = rateCheck('delete', req);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: '删除过于频繁', retryAfter: rate.retryAfter }),
      { status: 429, headers: { ...corsHeaders, 'Retry-After': String(rate.retryAfter) } }
    );
  }
  if (!ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '管理员密码未配置（Vercel 后台缺少 ADMIN_PASSWORD 环境变量）' }),
      { status: 503, headers: corsHeaders }
    );
  }
  if (!checkAdmin(req)) {
    return new Response(
      JSON.stringify({ error: '需要管理员密码' }),
      { status: 401, headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="Admin"' } }
    );
  }

  let payload;
  try { payload = await req.json(); } catch (e) {
    return new Response(
      JSON.stringify({ error: '请求体不是合法 JSON' }),
      { status: 400, headers: corsHeaders }
    );
  }
  const id = payload.id;
  if (!id) {
    return new Response(
      JSON.stringify({ error: '缺少 id 字段' }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { records, sha } = await readDb();
    const next = records.filter(r => r.id !== id);
    await writeDb(next, sha, 'delete one report');
    return new Response(
      JSON.stringify({ ok: true, id }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('delete error', e);
    return new Response(
      JSON.stringify({ error: '删除失败: ' + e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
