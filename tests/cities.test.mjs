// Six cities: the gazetteer, the generated browser copies, the launch date check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { browserFile } from '../scripts/gen-cities.mjs';
import { CITY_NAMES, findPlace, isLaunched, areasOf } from '../services/places.mjs';

test('ac-cities.js is generated from data/cities.json (and the PK copy is identical when present)', () => {
  assert.equal(fs.readFileSync(new URL('../ac-cities.js', import.meta.url), 'utf8'), browserFile());
  const pk = new URL('../../Agenticcore-pk/js/ac-cities.js', import.meta.url);
  if (fs.existsSync(pk)) assert.equal(fs.readFileSync(pk, 'utf8'), browserFile());
});

test('six cities in order; the requested areas are present; "Other" stays possible (free text)', () => {
  assert.deepEqual(CITY_NAMES, ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Sialkot', 'Faisalabad']);
  const want = { Lahore: ['DHA Lahore', 'Bahria Town Lahore', 'Gulberg', 'Johar Town', 'Model Town'], Karachi: ['DHA Karachi', 'Clifton', 'Bahria Town Karachi', 'Gulshan-e-Iqbal', 'Scheme 33'],
    Sialkot: ['Cantonment', 'DHA Sialkot', 'Sialkot city'], Faisalabad: ['Citi Housing Faisalabad', 'Eden Valley', 'Faisalabad city'] };
  for (const [c, list] of Object.entries(want)) for (const a of list) assert.ok(areasOf(c).includes(a), c + ': ' + a);
});

test('all of Pakistan: no city has a launch date — every city is open, no "Launching" labels', () => {
  for (const c of ['Islamabad', 'Rawalpindi', 'Lahore', 'Karachi', 'Sialkot', 'Faisalabad'])
    assert.equal(isLaunched(c, new Date('2020-01-01')), true, c);
  const ctx = { document: undefined, Date };
  vm.createContext(ctx); vm.runInContext(browserFile(), ctx);
  for (const c of ['Lahore', 'Karachi', 'Islamabad']) assert.equal(vm.runInContext("acCityLabel('" + c + "', 'en')", ctx), c);
  assert.equal(vm.runInContext('acAnyCityLaunching()', ctx), false);
  const dict = { t: 'Coming', t_live: 'Now live' };
  vm.runInContext('acApplyLaunchCopy', ctx)(dict);
  assert.equal(dict.t, 'Now live');
});

test('area → city: sectors, societies, Urdu-free text, border societies flagged', () => {
  const p = (q) => findPlace(q);
  assert.equal(p('G-10').impliedCity, 'Islamabad');
  assert.equal(p('house in F 7/2').impliedCity, 'Islamabad');
  assert.equal(p('Clifton').impliedCity, 'Karachi');
  assert.equal(p('johar town').impliedCity, 'Lahore');
  assert.equal(p('eden valley').impliedCity, 'Faisalabad');
  assert.equal(p('Cantonment').impliedCity, 'Sialkot');
  assert.equal(p('Satellite Town').impliedCity, 'Rawalpindi');
  assert.equal(p('Bahria Town Phase 7').ambiguous, true);
  assert.equal(p('new construction house').area, null, 'ordinary words are not places');
  assert.equal(p('eighteen lakh').area, null);
});
