// GET /api/list?period=YYYY-MM
// 列出所有月报
// 鉴权：任何人

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'monthly-reports';

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

  const period = (event.queryStringParameters || {}).period;

  try {
    const store = getStore(STORE_NAME);
    const { blobs } = await store.list();
    const records = [];
    for (const b of blobs) {
      try {
        const data = await store.get(b.key, { type: 'json' });
        if (data && (!period || data.period === period)) {
          records.push(data);
        }
      } catch (_) { /* 跳过 */ }
    }
    // 按时间倒序
    records.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        records,
        count: records.length,
        period: period || null
      })
    };
  } catch (e) {
    console.error('list error', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '查询失败: ' + e.message })
    };
  }
};
