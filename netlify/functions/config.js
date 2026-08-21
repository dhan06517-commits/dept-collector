// GET /api/config
// 返回前端需要的配置（管理员密码从环境变量读，不暴露源码）
// 鉴权：任何人（因为密码需要在客户端用于 Basic Auth 编码）

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: '仅支持 GET' })
    };
  }

  if (!ADMIN_PASSWORD) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: '管理员密码未在 Netlify 后台配置（环境变量 ADMIN_PASSWORD 缺失）'
      })
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      adminPassword: ADMIN_PASSWORD
    })
  };
};
