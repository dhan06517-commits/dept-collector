// GitHub Repo JSON 存储 helper
// 用 fetch 直接调 GitHub Contents API

const GITHUB_API = 'https://api.github.com';
const REPO_OWNER = process.env.GITHUB_OWNER || 'dhan06517-commits';
const REPO_NAME = process.env.GITHUB_REPO || 'dept-collector';
const FILE_PATH = 'data/monthly-reports.json';

function ghHeaders() {
  return {
    'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'monthly-report-vercel-fn'
  };
}

async function readDb() {
  const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}`;
  const r = await fetch(url, { headers: ghHeaders() });
  if (r.status === 404) return { records: [], sha: null };
  if (!r.ok) throw new Error(`GitHub GET 失败: ${r.status}`);
  const data = await r.json();
  const content = Buffer.from(data.content, 'base64').toString('utf8');
  const parsed = JSON.parse(content || '{"records":[]}');
  return { records: parsed.records || [], sha: data.sha };
}

async function writeDb(records, sha, message) {
  const url = `${GITHUB_API}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(FILE_PATH)}`;
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
    throw new Error(`GitHub PUT 失败: ${r.status} ${err.message || ''}`);
  }
  return r.json();
}

/**
 * 返回 store-like 对象
 * list() 直接返回 records 数组（不是包装对象）
 */
export function getStore() {
  return {
    list: async (period) => {
      const { records, sha } = await readDb();
      const filtered = period
        ? records.filter(r => r.period === period)
        : records;
      return filtered;  // 直接返回数组
    },
    writeAll: async (records, message) => {
      // 一次读写（用于覆盖整个文件）
      const { sha } = await readDb();
      await writeDb(records, sha, message);
      return { ok: true, count: records.length };
    }
  };
}

export { readDb, writeDb };
