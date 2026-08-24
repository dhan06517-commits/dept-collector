// GET /api/admin-list
// 返回完整月报内容（包含所有字段）
// 鉴权方式 1：Basic Auth（向后兼容）
// 鉴权方式 2：Header X-Admin-Password（页面内登录用）

import { getStore } from './_github.js';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const checkAdmin = (req) => {
  // 方式 1：自定义 Header（页面内登录）
  const customPw = req.headers.get('x-admin-password');
  if (customPw && customPw === ADMIN_PASSWORD) return true;
  // 方式 2：Basic Auth
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (auth && auth.startsWith('Basic ')) {
    try {
      const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i >= 0 && decoded.slice(i + 1) === ADMIN_PASSWORD) return true;
    } catch (_) {}
  }
  return false;
};

export async function GET(req) {
  if (!process.env.GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }), { status: 503, headers: corsHeaders });
  }
  if (!ADMIN_PASSWORD) {
    return new Response(JSON.stringify({ error: '管理员密码未配置' }), { status: 503, headers: corsHeaders });
  }
  if (!checkAdmin(req)) {
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
      JSON.stringify({ records, count: records.length, period: period || null }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: '查询失败: ' + e.message }), { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
