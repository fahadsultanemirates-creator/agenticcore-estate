// Run: node --test tests/*.test.mjs
// Activation phase: join links and return destinations (auth.js) only follow
// same-site pages and allow-listed intents; an intent never grants anything.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../auth.js', import.meta.url), 'utf8');
function load(search) {
  const ctx = { URLSearchParams, window: { location: { search } }, document: { getElementById: () => null } };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.acSafeNext = acSafeNext; this.acJoinIntent = acJoinIntent; this.AC_JOIN = AC_JOIN;', ctx);
  return ctx;
}

test('return destinations: same-site pages and dashboard modules only', () => {
  assert.equal(load('?next=' + encodeURIComponent('my.html#agency')).acSafeNext(), 'my.html#agency');
  assert.equal(load('?next=sell.html').acSafeNext(), 'sell.html');
  assert.equal(load('?next=' + encodeURIComponent('sheet.html?id=abc-1')).acSafeNext(), 'sheet.html?id=abc-1');
  for (const bad of ['https://evil.example/a.html', '//evil.example/a.html', 'javascript:alert(1)', '../admin.html', 'my.html#<x>', 'my.html#a"b'])
    assert.equal(load('?next=' + encodeURIComponent(bad)).acSafeNext(), '', bad);
});

test('join intents: allow-listed, derived from a known destination, never a privileged role', () => {
  assert.equal(load('?intent=agency').acJoinIntent(), 'agency');
  assert.equal(load('?intent=list').acJoinIntent(), 'list');
  assert.equal(load('?next=' + encodeURIComponent('my.html#company')).acJoinIntent(), 'builder');
  assert.equal(load('?intent=admin').acJoinIntent(), null);
  assert.equal(load('?intent=__proto__').acJoinIntent(), null);
  const roles = Object.values(load('').AC_JOIN).map((j) => j.role);
  assert.ok(!roles.includes('admin'));
  // project publishing still needs the admin-approved capability: developer goes through the application
  assert.equal(load('').AC_JOIN.developer.role, 'developer');
});
