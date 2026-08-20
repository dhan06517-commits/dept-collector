// POST /api/submit
// 提交/覆盖一条月报
// 鉴权：任何人
// 存储：GitHub Repo `data/monthly-reports.json`

const GITHUB_API = 'https://api.github.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

const ghHeaders = () => ({
  'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'monthly-report-netlify-fn'
});

const repoPath = () => ({
  owner: process.env.GITHUB_OWNER || 'dhan06517-commits',
  repo: process.env.GITHUB_REPO || 'dept-collector',
  path: 'data/monthly-reports.json'
});

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

async function readDb() {
  const { owner, repo, path } = repoPath();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return { records: [], sha: null };
  if (!r.ok) throw new Error(`GitHub GET 失败: ${r.status}`);
  const data = await r.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  const records = JSON.parse(content || '{"records":[]}');
  return { records: records.records || [], sha: data.sha };
}

async function writeDb(records, sha, message) {
  const { owner, repo, path } = repoPath();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message,
    content: Buffer.from(JSON.stringify({ records }, null, 2)).toString('base64'),
    sha: sha || undefined
  };
  const r = await fetch(url, {
    method: 'PUT',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`GitHub PUT 失败: ${r.status} ${err.message || r.statusText}`);
  }
  return r.json();
}

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
  if (!process.env.GITHUB_TOKEN) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'GITHUB_TOKEN 未配置' })
    };
  }

  let payload;
  try {
    // 客户端会把 body 做 utf-8 → base64 编码再发，避免 Netlify 默认 latin1 解码丢失中文
    let raw = event.body || '{}';
    if (event.isBase64Encoded) {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } else {
      // 兼容直接发送 UTF-8 字节（curl --data-binary 等场景）：
      // 先尝试 base64 解码（如果解码后是合法 JSON 就用），否则按 latin1→utf8 还原
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
          raw = decoded;
        } else {
          throw new Error('not base64');
        }
      } catch (_) {
        // 不是 base64，尝试 latin1→utf8 还原（Netlify 默认 latin1 解码场景）
        try {
          const recovered = Buffer.from(raw, 'binary').toString('utf8');
          if (recovered.trim().startsWith('{') || recovered.trim().startsWith('[')) {
            raw = recovered;
          } else {
            raw = event.body || '{}';
          }
        } catch (_) {
          raw = event.body || '{}';
        }
      }
    }
    payload = JSON.parse(raw);
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
      body: JSON.stringify({ error: 'record 缺少必要字段' })
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
    const { records, sha } = await readDb();
    const key = (r) => `${r.period}|${r.dept}|${r.name}`;
    const dupes = records.filter(r => key(r) === key(record) && r.id !== record.id);
    const next = records.filter(r => key(r) !== key(record));
    next.push(record);
    await writeDb(next, sha, dupes.length > 0 ? 'update report (cover)' : 'submit new report');

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        id: record.id,
        replaced: dupes.length > 0,
        replacedIds: dupes.map(r => r.id)
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