// GET /api/list?period=YYYY-MM
// 列出所有月报
// 鉴权：任何人
// 存储：GitHub Repo `data/monthly-reports.json`

const GITHUB_API = 'https://api.github.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/**
 * 读取仓库里的 JSON 文件。如果文件不存在，返回空 records 数组。
 * 返回 { records, sha } —— sha 用来后续更新。
 */
async function readDb() {
  const { owner, repo, path } = repoPath();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) {
    return { records: [], sha: null };
  }
  if (!r.ok) {
    throw new Error(`GitHub GET 失败: ${r.status} ${r.statusText}`);
  }
  const data = await r.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  const records = JSON.parse(content || '{"records":[]}');
  return { records: records.records || [], sha: data.sha };
}

/**
 * 写回仓库的 JSON 文件。需要 sha（乐观锁），并发写会失败。
 */
async function writeDb(records, sha) {
  const { owner, repo, path } = repoPath();
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const body = {
    message: 'update monthly-reports',
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
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: '仅支持 GET' })
    };
  }
  if (!process.env.GITHUB_TOKEN) {
    return {
      statusCode: 503,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'GITHUB_TOKEN 未配置。请在 Netlify 后台设置环境变量',
        hint: 'Site settings → Environment variables → 新增 GITHUB_TOKEN = 你的 GitHub PAT'
      })
    };
  }

  const period = (event.queryStringParameters || {}).period;

  try {
    const { records } = await readDb();
    const filtered = period ? records.filter(r => r.period === period) : records;
    filtered.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        records: filtered,
        count: filtered.length,
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