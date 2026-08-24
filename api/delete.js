// POST /api/delete
// 删除单条月报
// 鉴权：无（访问控制靠 URL ?admin=admin123 + 前端 PIN 校验）

import { readDb, writeDb } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function POST(req) {
  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }),
      { status: 503, headers: corsHeaders }
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
