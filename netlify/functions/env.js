// GET /api/env
// 调试端点：返回所有环境变量
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json'
};

exports.handler = async () => {
  // 列出关键环境变量
  const env = {
    SITE_ID: process.env.SITE_ID || 'MISSING',
    NETLIFY_BLOBS_CONTEXT: process.env.NETLIFY_BLOBS_CONTEXT || 'MISSING',
    NODE_ENV: process.env.NODE_ENV || 'MISSING',
    DEPLOY_ID: process.env.DEPLOY_ID || 'MISSING',
    DEPLOY_URL: process.env.DEPLOY_URL || 'MISSING',
    URL: process.env.URL || 'MISSING',
    // 检查 Netlify Blobs 需要的
    has_netlify_blobs_context: !!process.env.NETLIFY_BLOBS_CONTEXT
  };
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(env, null, 2)
  };
};
