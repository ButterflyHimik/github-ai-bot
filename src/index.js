import { analyzePR } from './analyze.js';
import { getPR, getPRFiles, addPRComment } from './github-api.js';

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

  if (!prResult.ok || !filesResult.ok) {
    console.error(`❌ API error:\n  PR:   ${prResult.ok ? '' : prResult.error}
  Files: ${filesResult.ok ? '' : filesResult.error}`);
    process.exit(1);
  }

  const analysis = analyzePR(prResult.data, filesResult.data);
  const comment  = buildComment(analysis, owner, repo);

  const result = await addPRComment(prNumber, comment);
  if (!result.ok) {
    console.error(`❌ Failed to post comment: ${result.error}`);
    process.exit(1);
  }

  console.log(`✅ Review posted on PR #${prNumber}`);
  console.log(`📊 Score: ${analysis.score}/100 | Language: ${analysis.language ?? 'N/A'}`);
  console.log(`📝 ${analysis.files.length} file(s) | +${analysis.stats.additions} / -${analysis.stats.deletions} lines`);
}

function buildComment(a, owner, repo) {
  const url = `https://github.com/${owner}/${repo}/pulls/${a.number}`;

  const scoreEmoji = a.score >= 80 ? '🟢' : a.score >= 60 ? '🟡' : '🔴';
  const lines = [];

  lines.push(`# ${scoreEmoji} AI Code Review`);
  lines.push('');
  lines.push(`**PR:** #${a.number} — [${a.title}](${url})`);
  lines.push(`**Author:** @${a.author}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Stats table
  lines.push('| 📊 Metric | Value |');
  lines.push('|-----------|-------|');
  lines.push(`| Files changed | ${a.files.length} |`);
  lines.push(`| Lines added   | +${a.stats.additions} |`);
  lines.push(`| Lines removed | -${a.stats.deletions} |`);
  lines.push(`| Net change    | ${a.stats.net >= 0 ? '+' : ''}${a.stats.net} |`);
  lines.push(`| Language      | ${a.language ?? 'Mixed'} |`);
  lines.push(`| **Score**     | **${a.score}/100** ${scoreEmoji} |`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Highlights
  if (a.highlights.length > 0) {
    lines.push('## ✅ Highlights');
    lines.push('');
    for (const h of a.highlights) lines.push(`- ${h}`);
    lines.push('');
  }

  // Issues
  if (a.issues.length > 0) {
    lines.push('## ⚠️ Suggestions');
    lines.push('');
    const sevEmoji = { high: '🔴', medium: '🟡', low: '⚪' };
    for (const issue of a.issues) {
      const fileRef = issue.file === '-' ? '**PR-level**' : `**${issue.file}**`;
      lines.push(`- ${sevEmoji[issue.severity]} ${fileRef} — ${issue.message}`);
    }
    lines.push('');
  } else {
    lines.push('## ✅ Looks good!');
    lines.push('');
    lines.push('No issues detected. Great work! 🎉');
    lines.push('');
  }

  if (a.suggestions.length > 0) {
    lines.push('---');
    lines.push('');
    for (const s of a.suggestions) lines.push(`💡 ${s}`);
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push(`*Automated review by* [🦋 ButterflyHimik](https://github.com/ButterflyHimik)*`);

  return lines.join('\n');
}

main().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
