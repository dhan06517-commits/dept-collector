// GET /api/list?period=YYYY-MM
// 只返回"已提交/待提交"部门名列表（不含任何月报内容）
// 鉴权：任何人（但数据脱敏，只看到部门名 + 是否已交）
// 月报内容请访问 /api/admin/list（需 Basic Auth）

import { getStore } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function GET(req) {
  // Vercel 提供 nextUrl，包含完整 URL 参数
  const period = req.nextUrl?.searchParams.get('period');

  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }),
      { status: 503, headers: corsHeaders }
    );
  }

  try {
    const all = await getStore().list(period);
    // 数据脱敏：只暴露部门和提交时间，不返回月报内容
    const summary = all.map(r => ({
      dept: r.dept,
      name: r.name,
      period: r.period,
      ts: r.ts
      // ❌ 不返回 keyWork / coreKpi / projects / difficulties / meta
    }));
    summary.sort((a, b) => (a.dept || '').localeCompare(b.dept || ''));
    return new Response(
      JSON.stringify({
        records: summary,
        count: summary.length,
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
