// POST /api/submit
// 提交/覆盖一条月报
// 鉴权：任何人（不要求 Basic Auth）
// 入参：{ record: { id, period, dept, name, ts, keyWork, coreKpi, projects, difficulties } }
// 校验：period 必须等于当月（YYYY-MM）

const { getStore } = require('@netlify/blobs');

const STORE_NAME = 'monthly-reports';

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
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
      body: JSON.stringify({
        error: 'Netlify Blobs 尚未为该项目初始化'
      })
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
  const record = payload.record;
  if (!record || !record.id || !record.period || !record.dept || !record.name) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'record 缺少必要字段 (id/period/dept/name)' })
    };
  }

  // 校验：仅限当月
  if (record.period !== currentPeriod()) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({
        error: `仅限当月提交（当前期次 ${currentPeriod()}），您提交的期次 ${record.period} 已被禁止`
      })
    };
  }

  try {
    const store = getStore(STORE_NAME);
    // 去重：按 (period, dept, name) 找同组旧记录并删除
    const { blobs } = await store.list();
    const dupes = [];
    for (const b of blobs) {
      try {
        const data = await store.get(b.key, { type: 'json' });
        if (data && data.period === record.period &&
            data.dept === record.dept &&
            data.name === record.name &&
            b.key !== record.id) {
          dupes.push(b.key);
        }
      } catch (_) { /* 跳过解析失败的 */ }
    }
    for (const k of dupes) {
      await store.delete(k);
    }

    // 写入新记录
    await store.setJSON(record.id, {
      id: record.id,
      period: record.period,
      dept: record.dept,
      name: record.name,
      ts: record.ts || new Date().toISOString(),
      keyWork: record.keyWork || {},
      coreKpi: record.coreKpi || {},
      projects: record.projects || {},
      difficulties: record.difficulties || {}
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        id: record.id,
        replaced: dupes.length > 0,
        replacedIds: dupes
      })
    };
  } catch (e) {
    console.error('submit error', e);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: '提交失败: ' + e.message })
    };
  }
};
