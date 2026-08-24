// GET /api/list?period=YYYY-MM
// 列出所有月报
// 鉴权：任何人

import { getStore } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function GET(req) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const period = url.searchParams.get('period');

  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }),
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const records = await getStore().list(period);
    records.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return new Response(
      JSON.stringify({
        records,
        count: records.length,
        period: period || null
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('list error', e);
    return new Response(
      JSON.stringify({ error: '查询失败: ' + e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
