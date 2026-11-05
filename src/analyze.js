/**
 * Analyzes PR diff files and produces actionable insights.
 * Zero dependencies — pure string manipulation on the unified diff format.
 */

// --- Helpers ---

function getPathExtension(path) {
  const name = path.split('/').pop().toLowerCase();
  const ext = (name.match(/\.[^\.]+$/) || [''])[0].slice(1);
  const extMap = {
    js: 'JavaScript', jsx: 'JavaScript (JSX)',
    ts: 'TypeScript', tsx: 'TypeScript (TSX)',
    py: 'Python', go: 'Go', rb: 'Ruby', java: 'Java',
    kt: 'Kotlin', c: 'C', cpp: 'C++', rs: 'Rust',
    html: 'HTML', css: 'CSS', scss: 'SCSS',
    md: 'Markdown', yml: 'YAML', yaml: 'YAML',
    json: 'JSON', sh: 'Shell', xml: 'XML',
  };
  return extMap[ext] || ext;
}

function extractAddedLines(patch) {
  if (!patch) return [];
  return patch.split('\n').filter(line => line.startsWith('+') && !line.startsWith('+++'));
}

function isTestFile(path) {
  const name = path.toLowerCase();
  return name.includes('test') || name.endsWith('.spec.js') ||
         name.endsWith('.spec.ts') || name.includes('__tests__') ||
         name.includes('_test.go') || name.endsWith('_test.rb');
}

function isDocOrConfig(path) {
  const ext = getPathExtension(path);
  return ['YAML', 'YAML', 'JSON', 'Markdown', 'CSS', 'SCSS', 'HTML'].includes(ext) ||
         path.split('/').pop().startsWith('package') ||
         path.split('/').pop().startsWith('webpack') ||
         path.includes('node_modules') ||
         path.includes('.github');
}

// --- Main analysis ---

export function analyzePR(pr, files) {
  const analysis = {
    title: pr.title,
    number: pr.number,
    author: pr.user.login,
    language: null,
    stats: { additions: 0, deletions: 0, net: 0 },
    files: [],
    issues: [],   // { file, type, message, severity }
    highlights: [], // strings
    suggestions: [], // strings
    score: 85 // default
  };

  for (const file of files) {
    const additions = file.additions ?? 0;
    const deletions = file.deletions ?? 0;
    analysis.stats.additions += additions;
    analysis.stats.deletions += deletions;
    analysis.files.push(file.path);

    // Detect primary language (skip non-code files)
    if (additions + deletions > 0) {
      const lang = getPathExtension(file.path);
      if (lang && lang !== 'YAML' && lang !== 'JSON' && lang !== 'Markdown') {
        analysis.language = lang;
      }
    }

    const addedLines = extractAddedLines(file.patch);

    const isJS = ['JavaScript', 'JavaScript (JSX)', 'TypeScript', 'TypeScript (TSX)'].includes(getPathExtension(file.path));

    // ── console.log / console.error in source (skip tests) ──
    if (['JavaScript', 'JavaScript (JSX)', 'TypeScript', 'TypeScript (TSX)'].includes(getPathExtension(file.path))) {
      const consoleLines = addedLines.filter(l => isJS && /console\.(log|error|warn)\s*\(/.test(l));
      if (consoleLines.length > 0 && !isTestFile(file.path)) {
        analysis.issues.push({
          file: file.path,
          type: 'debug',
          message: `${consoleLines.length} console.log/error statement(s) found — remove before merge`,
          severity: 'low'
        });
      }
    }

    // ── TODO / FIXME / HACK markers ──
    const todos = addedLines.filter(l => /\bTODO\b|\bFIXME\b|\bHACK\b/i.test(l));
    if (todos.length > 0) {
      analysis.issues.push({
        file: file.path,
        type: 'todo',
        message: `${todos.length} TODO/FIXME marker(s) — consider closing these out or linking to an issue`,
        severity: todos.length > 3 ? 'medium' : 'low'
      });
    }

    // ── Large single file ──
    if (additions > 300 && !isDocOrConfig(file.path)) {
      analysis.issues.push({
        file: file.path,
        type: 'file-size',
        message: `+${additions} lines in a single file — consider extracting functions/modules`,
        severity: 'low'
      });
    }
  }

  analysis.stats.net = analysis.stats.additions - analysis.stats.deletions;

  // ── Test coverage check ──
  const testFiles = files.filter(f => isTestFile(f.path));
  const sourceFiles = files.filter(f =>
    !isTestFile(f.path) && !isDocOrConfig(f.path) && f.path.length > 0
  );

  if (sourceFiles.length > 0 && testFiles.length === 0) {
    analysis.issues.push({
      file: '-',
      type: 'tests',
      message: `No test files added with ${sourceFiles.length} source file(s) changed — add tests!`,
      severity: 'medium'
    });
  } else if (testFiles.length > 0) {
    analysis.highlights.push(`✅ ${testFiles.length} test file(s) added`);
  }

  // ── Overall diff size ──
  if (analysis.stats.additions > 500) {
    analysis.issues.push({
      file: '-',
      type: 'size',
      message: `Large diff: +${analysis.stats.additions} lines. Consider splitting into smaller PRs for easier review.`,
      severity: 'high'
    });
  } else if (analysis.stats.additions > 200) {
    analysis.issues.push({
      file: '-',
      type: 'size',
      message: `Large diff: +${analysis.stats.additions} lines. Consider splitting for easier review.`,
      severity: 'low'
    });
  }

  // ── Score computation ──
  const highCount  = analysis.issues.filter(i => i.severity === 'high').length;
  const medCount   = analysis.issues.filter(i => i.severity === 'medium').length;
  const lowCount   = analysis.issues.filter(i => i.severity === 'low').length;
  analysis.score   = Math.max(0, 85 - highCount * 30 - medCount * 15 - lowCount * 5);
  analysis.score   = Math.round(analysis.score);

  // ── Additional highlights ──
  if (analysis.stats.additions > 0 && analysis.stats.deletions > 0) {
    analysis.highlights.push(`Balanced refactoring: +${analysis.stats.additions} / -${analysis.stats.deletions}`);
  }
  if (analysis.stats.additions > 0 && analysis.stats.deletions === 0) {
    analysis.highlights.push(`Net new code: +${analysis.stats.additions} lines`);
  }

  // ── Suggestions ──
  if (analysis.files.length > 10) {
    analysis.suggestions.push('10+ files changed — consider a code review session before merging');
  }

  return analysis;
}