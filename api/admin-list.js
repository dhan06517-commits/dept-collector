// GET /api/admin-list
// 返回完整月报内容
// 鉴权：无（访问控制靠 URL ?admin=admin123 + 前端 PIN 校验）

import { getStore } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function GET(req) {
  if (!process.env.GITHUB_TOKEN) {
    return new Response(JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }), { status: 503, headers: corsHeaders });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const period = url.searchParams.get('period');

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
