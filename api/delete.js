// POST /api/delete
// 删除单条月报
// 鉴权：Basic Auth（管理员密码）

import { readDb, writeDb } from './_github.js';
import { check as rateCheck, getIp } from './_rate-limiter.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const checkBasicAuth = (req) => {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return false;
    const user = decoded.slice(0, i);
    const pass = decoded.slice(i + 1);
    // Basic Auth：客户端 username 任意值（不验证），只验证密码
    return pass === ADMIN_PASSWORD;
  } catch (e) { return false; }
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
  if (!checkBasicAuth(req)) {
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
