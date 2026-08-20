// POST /api/clear
// 清空所有月报
// 鉴权：Basic Auth（管理员密码）

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'monthly-reports';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Kd8@mP3#xL9qV2wN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const checkBasicAuth = (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    return user === 'admin' && pass === ADMIN_PASSWORD;
  } catch (e) { return false; }
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: '仅支持 POST' })
    };
  }
  if (!process.env.NETLIFY_BLOBS_CONTEXT) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Netlify Blobs 尚未为该项目初始化' })
    };
  }
  if (!checkBasicAuth(event)) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="Admin"' },
      body: JSON.stringify({ error: '需要管理员密码' })
    };
  }

  try {
    const store = getStore(STORE_NAME);
    const { blobs } = await store.list();
    let count = 0;
    for (const b of blobs) {
      await store.delete(b.key);
      count++;
    }
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, count })
    };
  } catch (e) {
    console.error('clear error', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '清空失败: ' + e.message })
    };
  }
};
