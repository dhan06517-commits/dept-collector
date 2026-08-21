// GET /api/config
// 返回前端需要的配置（管理员密码从环境变量读）

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

export async function GET() {
  if (!ADMIN_PASSWORD) {
    return new Response(
      JSON.stringify({ error: '管理员密码未配置（Vercel 后台缺少 ADMIN_PASSWORD 环境变量）' }),
      { status: 503, headers: corsHeaders }
    );
  }
  return new Response(
    JSON.stringify({ adminPassword: ADMIN_PASSWORD }),
    { status: 200, headers: corsHeaders }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
