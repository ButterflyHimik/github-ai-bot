/**
 * Builds a human-readable Markdown review comment from an analyzePR() result.
 * Kept in a separate module so it can be tested and reused.
 */

export function buildComment(a, owner, repo) {
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
  lines.push(`| Language      | ${a.language || 'Mixed'} |`);
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
