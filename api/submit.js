// POST /api/submit
// 提交/覆盖一条月报
// 鉴权：任何人
// 存储：GitHub Repo `data/monthly-reports.json`

import { readDb, writeDb } from './_github.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function decodeBody(req) {
  const text = await req.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch (_) {}
  try {
    const decoded = Buffer.from(text, 'base64').toString('utf8');
    if (decoded && (decoded.trim().startsWith('{') || decoded.trim().startsWith('['))) {
      return JSON.parse(decoded);
    }
  } catch (_) {}
  try {
    const recovered = Buffer.from(text, 'binary').toString('utf8');
    if (recovered && (recovered.trim().startsWith('{') || recovered.trim().startsWith('['))) {
      return JSON.parse(recovered);
    }
  } catch (_) {}
  return JSON.parse(text);
}

export async function POST(req) {
  if (!process.env.GITHUB_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'GITHUB_TOKEN 未配置' }),
      { status: 503, headers: corsHeaders }
    );
  }


  const payload = await decodeBody(req);
  const record = payload.record;
  if (!record || !record.id || !record.period || !record.dept || !record.name) {
    return new Response(
      JSON.stringify({ error: 'record 缺少必要字段' }),
      { status: 400, headers: corsHeaders }
    );
  }

  if (record.period !== currentPeriod()) {
    return new Response(
      JSON.stringify({
        error: `仅限当月提交（当前期次 ${currentPeriod()}），您提交的期次 ${record.period} 已被禁止`
      }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    const { records, sha } = await readDb();
    const key = (r) => `${r.period}|${r.dept}|${r.name}`;
    const dupes = records.filter(r => key(r) === key(record) && r.id !== record.id);

    // 审计：服务端注入元数据
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim() || null;
    record.meta = {
      ...(record.meta || {}),
      submittedAt: new Date().toISOString(),
      submittedIp: ip,
      submittedUa: (req.headers['user-agent'] || '').slice(0, 200) || null
    };

    const next = records.filter(r => key(r) !== key(record));
    next.push(record);
    await writeDb(next, sha, dupes.length > 0 ? 'update report (cover)' : 'submit new report');

    return new Response(
      JSON.stringify({
        ok: true,
        id: record.id,
        replaced: dupes.length > 0,
        replacedIds: dupes.map(r => r.id)
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    console.error('submit error', e);
    return new Response(
      JSON.stringify({ error: '提交失败: ' + e.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
