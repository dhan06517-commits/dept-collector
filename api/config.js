// GET /api/config
// 当前未使用 — 管理员鉴权改为客户端 PIN + URL ?admin=admin123
// 保留此端点以便将来扩展

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, note: '管理员鉴权已迁移到前端 PIN，无服务端配置' }),
    { status: 200, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
