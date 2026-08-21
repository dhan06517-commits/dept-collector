// POST /api/clear
// 清空所有月报
// 鉴权：Basic Auth（管理员密码）

const GITHUB_API = 'https://api.github.com';
const { check: rateCheck } = require('./_rate-limiter');

// 优先从 Netlify 环境变量读（生产推荐），fallback 仅用于本地开发
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
  // Rate Limiting
  const rate = rateCheck('clear', event);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...corsHeaders, 'Retry-After': String(rate.retryAfter) },
      body: JSON.stringify({ error: '清空操作过于频繁', retryAfter: rate.retryAfter })
    };
  }
  if (!ADMIN_PASSWORD) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({ error: '管理员密码未配置（Netlify 后台缺少 ADMIN_PASSWORD 环境变量）' })
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
    // 直接覆写为空数组
    // 我们需要先获取当前 sha 才能写
    const { sha, records } = await readDb();
    await writeDb([], sha, 'clear all reports');
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ ok: true, count: records.length })
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