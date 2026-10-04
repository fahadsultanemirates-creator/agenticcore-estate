// Full area lists (Zameen.com + Graana.com research, 4 Oct 2026): dropdowns
// get every main area with live listings; the bots know every phase, block
// and sector — without picking places out of everyday words.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync(new URL('../data/cities.json', import.meta.url), 'utf8'));
const { findPlace, placeOf } = await import('../services/places.mjs');
const { pendingFacts } = await import('../services/memory.mjs');

test('every city has popular areas, all main areas A–Z and the full place list', () => {
  const want = { Islamabad: 1200, Rawalpindi: 600, Lahore: 2700, Karachi: 1800, Sialkot: 350, Faisalabad: 700 };
  for (const c of data.cities) {
    const all = c.areas.length + c.more.length + c.places.length;
    assert.ok(all >= want[c.name], c.name + ' ' + all);
    const sorted = c.more.slice().sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
    assert.deepEqual(c.more, sorted, c.name + ' more is A–Z');
    const seen = new Set(); for (const n of c.areas.concat(c.more, c.places)) { assert.ok(!seen.has(n), c.name + ' duplicate ' + n); seen.add(n); }
  }
  const browser = fs.readFileSync(new URL('../ac-cities.js', import.meta.url), 'utf8');
  assert.match(browser, /"Askari 12"/);                    // dropdown copy has the main areas…
  assert.doesNotMatch(browser, /DHA Phase 7 - Block Y/);    // …but not every block (bots only)
});

test('the bots know which city a phase, block or society is in', () => {
  const at = (q) => { const p = findPlace(q); return p.ambiguous ? p.cities.slice().sort().join('/') : p.city; };
  assert.equal(at('plot in DHA Phase 7 - Block Y'), 'Lahore');
  assert.equal(at('10 marla in Abdalians Society Block B'), 'Lahore');
  assert.equal(at('AGOCHS Phase 2'), 'Islamabad');
  assert.equal(at('house in Abbaspur'), 'Faisalabad');
  assert.equal(at('Bahria Town - Precinct 10'), 'Karachi');
  assert.equal(at('E-11/2'), 'Islamabad');
  assert.equal(at('Johar Town'), 'Lahore');
  assert.equal(at('Clifton'), 'Karachi');
  assert.equal(at('Satellite Town Rawalpindi'), 'Rawalpindi');
  assert.ok(findPlace('Saddar').ambiguous);                  // in several cities → the bot asks which
});

test('everyday words are not taken as places', () => {
  for (const q of ['house near airport', 'I want a house with a garden', 'flat in the city', 'main road facing plot', 'park facing corner house']) {
    assert.equal(findPlace(q).area, null, q);
  }
  assert.equal(placeOf('Airport').city, 'Karachi');          // the place itself, typed alone, still works
});

test('places already in the list never go to the owner for review', async () => {
  const store = { rest: async () => [{ id: 1, kind: 'area', city: 'Lahore', name: 'Abdalians Society - Block B', sources: 3 }, { id: 2, kind: 'area', city: 'Lahore', name: 'Noor Sahar Enclave', sources: 3 }] };
  assert.deepEqual((await pendingFacts(store, 10)).map((f) => f.id), [2]);
});
