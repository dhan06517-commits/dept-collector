// POST /api/clear
import { getHeader, getClientIp } from "./_headers.js";
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
  if (!checkAdmin(req)) {
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
