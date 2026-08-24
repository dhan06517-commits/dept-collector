// GET /api/admin/list
// 返回完整月报内容（包含所有字段）
// 鉴权：Basic Auth（管理员密码）

import { getStore } from './_github.js';

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
    return user === 'admin' && pass === ADMIN_PASSWORD;
  } catch (e) { return false; }
};

export async function GET(req) {
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

  const period = req.nextUrl?.searchParams.get('period');

  try {
    const records = await getStore().list(period);
    records.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return new Response(
      JSON.stringify({
        records,  // 完整内容
        count: records.length,
        period: period || null
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('admin list error', e);
    return new Response(
      JSON.stringify({ error: '查询失败: ' + e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
