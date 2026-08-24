// POST /api/clear
// 清空所有月报
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
