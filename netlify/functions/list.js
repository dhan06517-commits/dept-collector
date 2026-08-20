// GET /api/list?period=YYYY-MM
// 列出所有月报
// 鉴权：任何人

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'monthly-reports';

// 兜底：如果 Netlify Blobs 没自动注入，手动从环境变量读取
const getStoreWithFallback = () => {
  // 优先用自动注入（Netlify Functions 默认会有 siteID + token）
  // 如果失败则提示
  try {
    const store = getStore(STORE_NAME);
    return { store, mode: 'auto' };
  } catch (e) {
    return { error: e.message, mode: 'error' };
  }
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

  // 检查 Netlify Blobs 环境
  const hasContext = !!process.env.NETLIFY_BLOBS_CONTEXT;
  if (!hasContext) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Netlify Blobs 尚未为该项目初始化。请在 Netlify 后台：Project configuration → Functions → 启用 Blobs，或在 Build settings 中触发一次完整 build。',
        hint: '确认该项目已启用 Blobs 功能（免费 plan 也支持）'
      })
    };
  }

  try {
    const { store } = getStoreWithFallback();
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
    records.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        records,
        count: records.length,
        period: period || null,
        mode: 'auto'
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
