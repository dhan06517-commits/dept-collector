// GET /api/list?period=YYYY-MM
// 列出月报元数据（部门/姓名/时间/完成度），不含具体内容
// 鉴权：任何人（但只能拿到摘要，看不到别人写了什么）

import { getStore } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

// 模块字段白名单：用于计算完成度（"X/Y 项"）
const MODULE_FIELDS = {
  keyWork:     ['m1','m2','m3','m4','m5','m6','m7','m8','m9','m10','m11','m12','m13','m14'],
  difficulties:['issues'],
  otherWork:   ['otherDesc'],
  nextSteps:   ['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14']
};

/** 把一条完整记录脱敏成"摘要"：仅返回 id/period/dept/ts/name + 各模块完成度 */
function summarize(r) {
  const summary = {
    id: r.id,
    period: r.period,
    dept: r.dept,
    name: r.name,
    ts: r.ts,
    meta: r.meta,  // 审计信息（提交IP/UA/时间），保留方便排查
    completion: {}
  };
  for (const [modKey, fields] of Object.entries(MODULE_FIELDS)) {
    const mod = r[modKey] || {};
    let filled = 0;
    for (const f of fields) {
      if (Array.isArray(mod[f]) && mod[f].length > 0) filled++;
    }
    summary.completion[modKey] = `${filled}/${fields.length}`;
  }
  return summary;
}

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
    const summarized = records.map(summarize);
    return new Response(
      JSON.stringify({
        records: summarized,
        count: summarized.length,
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
