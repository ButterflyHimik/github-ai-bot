#!/usr/bin/env node
import { analyzePR } from './analyze.js';
import { getPR, getPRFiles, addPRComment } from './github-api.js';
import { buildComment } from './buildComment.js';

async function main() {
  const prNumber = process.env.GITHUB_PULL_REQUEST_NUMBER || process.argv[2] || '';
  if (!prNumber) {
    console.error('No PR number found. Set GITHUB_PULL_REQUEST_NUMBER or pass as arg.');
    process.exit(1);
  }

  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;

  if (!owner || !repo) {
    console.error('GITHUB_OWNER and GITHUB_REPO env vars are required.');
    process.exit(1);
  }

  console.log(`🦋 Analyzing PR #${prNumber} in ${owner}/${repo}...`);

  const [prResult, filesResult] = await Promise.all([
    getPR(prNumber),
    getPRFiles(prNumber)
  ]);

  const prErr    = !prResult.ok    ? (prResult.error || `HTTP ${prResult.status}`) : null;
  const filesErr = !filesResult.ok ? (filesResult.error || `HTTP ${filesResult.status}`) : null;
  if (prErr || filesErr) {
    console.error(`❌ API error:\n  PR:    ${prErr || 'OK'}\n  Files: ${filesErr || 'OK'}`);
    process.exit(1);
  }

  const analysis = analyzePR(prResult.data, filesResult.data);
  const comment  = buildComment(analysis, owner, repo);

  const result = await addPRComment(prNumber, comment);
  if (!result.ok) {
    console.error(`❌ Failed to post comment: ${result.error || `HTTP ${result.status}`}`);
    process.exit(1);
  }

  console.log(`✅ Review posted on PR #${prNumber}`);
  console.log(`📊 Score: ${analysis.score}/100 | Language: ${analysis.language || 'N/A'}`);
  console.log(`📝 ${analysis.files.length} file(s) | +${analysis.stats.additions} / -${analysis.stats.deletions} lines`);
}

main().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
