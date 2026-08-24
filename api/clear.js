// POST /api/clear
// 清空所有月报
// 鉴权：Basic Auth

import { readDb, writeDb } from './_github.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const checkBasicAuth = (req) => {
  const auth = req.headers['authorization'] || req.headers['Authorization'];
  if (!auth || !auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i < 0) return false;
    const pass = decoded.slice(i + 1);
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
  if (!ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '管理员密码未配置' }),
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
