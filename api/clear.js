// POST /api/clear
// 清空所有月报
// 鉴权：Basic Auth（管理员密码）

import { readDb, writeDb } from './_github.js';
import { check as rateCheck } from './_rate-limiter.js';

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
  const rate = rateCheck('clear', req);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({ error: '清空操作过于频繁', retryAfter: rate.retryAfter }),
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

  try {
    const { sha, records } = await readDb();
    await writeDb([], sha, 'clear all reports');
    return new Response(
      JSON.stringify({ ok: true, count: records.length }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('clear error', e);
    return new Response(
      JSON.stringify({ error: '清空失败: ' + e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
