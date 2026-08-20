// POST /api/delete
// 删除单条月报
// 鉴权：Basic Auth（管理员密码）

const GITHUB_API = 'https://api.github.com';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Kd8@mP3#xL9qV2wN';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

const checkBasicAuth = (event) => {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith('Basic ')) return false;
  try {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const [user, pass] = decoded.split(':');
    return user === 'admin' && pass === ADMIN_PASSWORD;
  } catch (e) { return false; }
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
  if (!checkBasicAuth(event)) {
    return {
      statusCode: 401,
      headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="Admin"' },
      body: JSON.stringify({ error: '需要管理员密码' })
    };
  }

  let payload;
  try {
    let raw = event.body || '{}';
    if (event.isBase64Encoded) {
      raw = Buffer.from(raw, 'base64').toString('utf8');
    } else {
      try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        if (decoded.trim().startsWith('{') || decoded.trim().startsWith('[')) {
          raw = decoded;
        } else {
          throw new Error('not base64');
        }
      } catch (_) {
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
  const id = payload.id;
  if (!id) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: '缺少 id 字段' })
    };
  }

  try {
    const { records, sha } = await readDb();
    const next = records.filter(r => r.id !== id);
    await writeDb(next, sha, 'delete one report');
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