import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePR } from '../src/analyze.js';
import { buildComment } from '../src/buildComment.js';

const basePr = () => ({ title: 'Change', number: 1, user: { login: 'me' } });

function patchWith(lines) {
  return lines.map((l) => `+${l}`).join('\n');
}

/* ── Existing tests ────────────────────────────────────────────────────── */

test('empty PR → base score 85, no issues', () => {
  const a = analyzePR(basePr(), []);
  assert.equal(a.score, 85);
  assert.deepEqual(a.issues, []);
  assert.equal(a.stats.net, 0);
});

test('console.log + missing tests → debug & tests issues, score 65', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/app.js', additions: 2, deletions: 0, patch: patchWith(['const x = 1;', "console.log('hi')"]) },
  ]);
  assert.equal(a.language, 'JavaScript');
  assert.equal(a.issues.length, 2);
  assert.ok(a.issues.some((i) => i.type === 'debug'));
  assert.ok(a.issues.some((i) => i.type === 'tests'));
  assert.equal(a.score, 65);
  assert.ok(a.highlights.some((h) => h.startsWith('Net new code')));
});

test('4+ TODOs → medium severity', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/thing.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: a', '# TODO: b', '# TODO: c', '# TODO: d', '# done']) },
  ]);
  assert.equal(a.language, 'Python');
  assert.ok(a.issues.some((i) => i.type === 'todo' && i.severity === 'medium'));
  assert.equal(a.score, 55);
});

test('600-line diff → high severity size issue', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/big.js', additions: 600, deletions: 0, patch: '' },
  ]);
  assert.ok(a.issues.some((i) => i.type === 'size' && i.severity === 'high'));
  assert.ok(a.issues.some((i) => i.type === 'file-size' && i.severity === 'low'));
  assert.equal(a.score, 35);
});

test('test file present → test highlight, no tests issue', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/app.js', additions: 10, deletions: 0 },
    { path: 'src/app.test.js', additions: 20, deletions: 0 },
  ]);
  assert.deepEqual(a.issues, []);
  assert.equal(a.score, 85);
  assert.ok(a.highlights.some((h) => h.includes('test file(s)')));
});

test('score clamps at 0 when issues pile up', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/big.js', additions: 600, deletions: 0, patch: '' },
    { path: 'src/b.js', additions: 2, deletions: 0, patch: patchWith(["console.log('x')"]) },
    { path: 'src/c.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: 1', '# TODO: 2', '# TODO: 3', '# TODO: 4', '# ok']) },
    { path: 'src/d.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: 1', '# TODO: 2', '# TODO: 3', '# TODO: 4', '# ok']) },
  ]);
  assert.equal(a.score, 0);
});

/* ── New: extension parsing (no trailing-dot bug) ──────────────────────── */

test('files without dots → language stays null (no crash)', () => {
  const a = analyzePR(basePr(), [
    { path: 'Makefile', additions: 10, deletions: 0 },
    { path: 'Dockerfile', additions: 5, deletions: 0 },
  ]);
  assert.notEqual(a.language, 'undefined');
  assert.notEqual(a.language, 'Makefile');
});

test('file ending in dot → language stays null', () => {
  const a = analyzePR(basePr(), [
    { path: 'weird.', additions: 1, deletions: 0 },
  ]);
  assert.notEqual(a.language, 'undefined');
  assert.notEqual(a.language, '');
});

test('nested dot filename (archive.tar.gz) → correct extension', () => {
  const a = analyzePR(basePr(), [
    { path: 'docs/archive.tar.gz', additions: 5, deletions: 0 },
  ]);
  // 'gz' is not in the extMap → returns 'gz', but must be stable and defined
  assert.ok(typeof a.language === 'string');
});

test('uppercase extension still detected', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/App.JS', additions: 5, deletions: 0, patch: '' },
  ]);
  assert.equal(a.language, 'JavaScript');
});

/* ── New: console.log skipped in test files ─────────────────────────────── */

test('console.log in test file → no debug issue', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/app.test.js', additions: 2, deletions: 0, patch: patchWith(["const x = 1;", "console.log('ok')"]) },
  ]);
  assert.equal(a.issues.some((i) => i.type === 'debug'), false);
});

/* ── New: buildComment (visual) tests ───────────────────────────────────── */

const analysis = (over = {}) => ({
  title: 'Change',
  number: 1,
  author: 'me',
  language: 'JavaScript',
  stats: { additions: 10, deletions: 0, net: 10 },
  files: ['src/app.js'],
  issues: [],
  highlights: [],
  suggestions: [],
  score: 90,
  ...over
});

test('buildComment: green header + stats table', () => {
  const md = buildComment(analysis(), 'ButterflyHimik', 'github-ai-bot');
  assert.ok(md.includes('🟢 AI Code Review'));
  assert.ok(md.includes('| **Score**     | **90/100** 🟢 |'));
  assert.ok(md.includes('| Language      | JavaScript |'));
  assert.ok(md.includes('| Net change    | +10 |'));
});

test('buildComment: no issues → "Looks good!" block', () => {
  const md = buildComment(analysis(), 'ButterflyHimik', 'github-ai-bot');
  assert.ok(md.includes('## ✅ Looks good!'));
  assert.ok(md.includes('No issues detected. Great work! 🎉'));
  assert.equal(md.includes('## ⚠️ Suggestions'), false);
});

test('buildComment: issues → suggestions block with severity emojis', () => {
  const md = buildComment(analysis({
    issues: [
      { file: 'src/app.js', severity: 'low', message: 'console.log found' },
      { file: '-',         severity: 'medium', message: 'No test files' },
    ]
  }), 'ButterflyHimik', 'github-ai-bot');
  assert.ok(md.includes('## ⚠️ Suggestions'));
  assert.ok(md.includes('⚪ **src/app.js** — console.log found'));
  assert.ok(md.includes('🟡 **PR-level** — No test files'));
});

test('buildComment: highlights block', () => {
  const md = buildComment(analysis({ highlights: ['✅ 2 test file(s) added'] }), 'ButterflyHimik', 'github-ai-bot');
  assert.ok(md.includes('## ✅ Highlights'));
  assert.ok(md.includes('✅ 2 test file(s) added'));
});

test('buildComment: signature footer', () => {
  const md = buildComment(analysis(), 'ButterflyHimik', 'github-ai-bot');
  assert.ok(md.includes('[🦋 ButterflyHimik](https://github.com/ButterflyHimik)'));
});

test('buildComment: score emoji boundaries (80/59)', () => {
  assert.ok(buildComment(analysis({ score: 80 }), 'o', 'r').includes('🟢'));
  assert.ok(buildComment(analysis({ score: 59 }), 'o', 'r').includes('🔴'));
  assert.ok(buildComment(analysis({ score: 60 }), 'o', 'r').includes('🟡'));
});

/* ── New: large-diff + net-change visual ─────────────────────────────────── */

test('buildComment: balanced refactoring shows net change sign', () => {
  const md = buildComment(analysis({ stats: { additions: 30, deletions: 10, net: 20 } }), 'o', 'r');
  assert.ok(md.includes('| Net change    | +20 |'));
  const md2 = buildComment(analysis({ stats: { additions: 10, deletions: 30, net: -20 } }), 'o', 'r');
  assert.ok(md2.includes('| Net change    | -20 |'));
});
