const GITHUB_API = 'https://api.github.com';

function githubFetch(url, { method = 'GET', headers = {}, body = null } = {}) {
  const headersOut = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...headers,
  };
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0) {
    headersOut.Authorization = `token ${process.env.GITHUB_TOKEN.trim()}`;
  }
  return fetch(`${GITHUB_API}${url}`, {
    method,
    headers: headersOut,
    body
  });
}

async function request(path, options = {}) {
  const response = await githubFetch(path, options);
  if (response.ok) {
    const data = await response.json();
    return { ok: true, data };
  }
  let error = null;
  try { error = await response.text(); } catch (e) { error = `HTTP ${response.status}: could not read error body`; }
  return { ok: false, status: response.status, error: error || `HTTP ${response.status}` };
}

export async function getPR(prNumber) {
  return request(
    `/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/pulls/${prNumber}`
  );
}

export async function getPRFiles(prNumber) {
  const params = new URLSearchParams({ per_page: 100 });
  return request(
    `/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/pulls/${prNumber}/files?${params}`
  );
}

export async function addPRComment(prNumber, body) {
  return request(
    `/repos/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/pulls/${prNumber}/comments`,
    { method: 'POST', body: JSON.stringify({ body }) }
  );
}