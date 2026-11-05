import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePR } from '../src/analyze.js';

const basePr = () => ({ title: 'Change', number: 1, user: { login: 'me' } });

function patchWith(lines) {
  return lines.map((l) => `+${l}`).join('\n');
}

test('empty PR \u2192 base score 85, no issues', () => {
  const a = analyzePR(basePr(), []);
  assert.equal(a.score, 85);
  assert.deepEqual(a.issues, []);
  assert.equal(a.stats.net, 0);
});

test('console.log + missing tests \u2192 debug & tests issues, score 65', () => {
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

test('4+ TODOs \u2192 medium severity', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/thing.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: a', '# TODO: b', '# TODO: c', '# TODO: d', '# done']) },
  ]);
  assert.equal(a.language, 'Python');
  assert.ok(a.issues.some((i) => i.type === 'todo' && i.severity === 'medium'));
  assert.equal(a.score, 55);
});

test('600-line diff \u2192 high severity size issue', () => {
  const a = analyzePR(basePr(), [
    { path: 'src/big.js', additions: 600, deletions: 0, patch: '' },
  ]);
  assert.ok(a.issues.some((i) => i.type === 'size' && i.severity === 'high'));
  assert.ok(a.issues.some((i) => i.type === 'file-size' && i.severity === 'low'));
  assert.equal(a.score, 35);
});

test('test file present \u2192 test highlight, no tests issue', () => {
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
    { path: 'src/big.js', additions: 600, deletions: 0, patch: '' }, // high + file-size low
    { path: 'src/b.js', additions: 2, deletions: 0, patch: patchWith(["console.log('x')"]) }, // low
    { path: 'src/c.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: 1', '# TODO: 2', '# TODO: 3', '# TODO: 4', '# ok']) }, // med
    { path: 'src/d.py', additions: 5, deletions: 0, patch: patchWith(['# TODO: 1', '# TODO: 2', '# TODO: 3', '# TODO: 4', '# ok']) }, // med
  ]);
  assert.equal(a.score, 0);
});
