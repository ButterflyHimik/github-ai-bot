const GITHUB_API = 'https://api.github.com';

function githubFetch(url, { method = 'GET', headers = {}, body = null } = {}) {
  return fetch(`${GITHUB_API}${url}`, {
    method,
    headers: {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      ...headers
    },
    body
  });
}

async function request(path, options = {}) {
  const response = await githubFetch(path, options);
  if (response.ok) {
    return { ok: true, data: await response.json() };
  }
  let error = null;
  try { error = await response.text(); } catch {};
  return { ok: false, status: response.status, error };
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