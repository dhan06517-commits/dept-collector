// POST /api/delete
// 删除单条月报
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
  if (!checkBasicAuth(event)) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="Admin"' },
      body: JSON.stringify({ error: '需要管理员密码' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: '请求体不是合法 JSON' })
    };
  }
  const id = payload.id;
  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: '缺少 id 字段' })
    };
  }

  try {
    const store = getStore(STORE_NAME);
    await store.delete(id);
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, id })
    };
  } catch (e) {
    console.error('delete error', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '删除失败: ' + e.message })
    };
  }
};
