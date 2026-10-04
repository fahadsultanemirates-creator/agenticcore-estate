// Merges a full area tree (Zameen.com + Graana.com research export, one
// "# <City> - areas/societies..." section per city, two-space indent per
// level, marks [Z] zameen only / [G] graana only, * / ^ = inferred parent)
// into data/cities.json:
//   areas   — the curated popular list (unchanged, shown first in dropdowns)
//   more    — every other top-level area with live listings (on both portals
//             or Zameen), A–Z: shown in dropdowns under "All areas A–Z"
//   places  — every other name (phases, blocks, sectors, Graana-only areas):
//             not shown in dropdowns, used by the bots to know which city a
//             place is in
// Then run: node scripts/gen-cities.mjs
//
//   node scripts/import-areas.mjs data/research/areas-zameen-graana-2026-10-04.txt

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = process.argv[2];
if (!file) { console.error('usage: node scripts/import-areas.mjs <areas.txt>'); process.exit(1); }

const data = JSON.parse(fs.readFileSync(path.join(root, 'data/cities.json'), 'utf8'));

// Slug-derived Graana names come in as "Dha Phase 2", "Fda City": restore acronyms.
const ACRONYMS = ['DHA', 'FDA', 'LDA', 'CDA', 'RDA', 'KDA', 'PHA', 'PECHS', 'KDA', 'PCSIR', 'WAPDA', 'NESPAK', 'EME', 'PIA', 'PAF', 'OGDCL', 'FECHS', 'AGOCHS',
  'MPCHS', 'PWD', 'CBR', 'NFC', 'PGECHS', 'ECHS', 'KRL', 'GECHS', 'DOHS', 'PHATA', 'SDA', 'NIH', 'OPF', 'IEP', 'FGEHA', 'ISSB', 'NPF', 'PCSIR', 'TECH', 'II', 'III', 'IV', 'VI', 'VII'];
function tidy(name) {
  return name.split(/(\s+)/).map((w) => {
    const up = w.toUpperCase();
    return ACRONYMS.includes(up) && w !== up ? up : w;
  }).join('').replace(/\s+/g, ' ').trim();
}
const loose = (s) => String(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ')
  .replace(/\b(housing|society|scheme|co ?operative|cooperative|chs)\b/g, ' ').replace(/\s+/g, ' ').trim();

// ---- parse ----
const tree = {};
let city = null;
for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
  const head = raw.match(/^# (\w[\w ]*?) - areas\/societies/);
  if (head) { city = head[1]; tree[city] = []; continue; }
  if (!city || !raw.trim() || raw.startsWith('#')) continue;
  const depth = Math.floor((raw.length - raw.trimStart().length) / 2);
  const t = raw.trim();
  const src = /\[G\]/.test(t) ? 'G' : /\[Z\]/.test(t) ? 'Z' : 'B';
  const name = tidy(t.replace(/\s*\[[ZG]\]/g, '').replace(/\s*[*^]+\s*$/, '').trim());
  if (name.length >= 2 && name.length <= 80) tree[city].push({ name, depth, src });
}

// ---- merge ----
let added = 0;
for (const c of data.cities) {
  const nodes = tree[c.name];
  if (!nodes) { console.log(c.name + ': not in the file, unchanged'); continue; }
  const seen = new Set();
  const mark = (n) => { seen.add(loose(n)); seen.add(loose(n.replace(new RegExp('\\s+' + c.name + '$', 'i'), ''))); };
  c.areas.forEach(mark);
  data.shared.filter((s) => s.cities.includes(c.name)).forEach((s) => mark(s.name));
  const more = [], places = [];
  for (const n of nodes) {
    if (seen.has(loose(n.name))) continue;
    mark(n.name);
    if (n.depth === 0 && n.src !== 'G') more.push(n.name); else places.push(n.name);
  }
  c.more = more.sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  c.places = places;
  added += more.length + places.length;
  console.log(`${c.name}: ${c.areas.length} popular + ${more.length} more (dropdown) + ${places.length} places (bots)`);
}
data._sources = (data._sources || []).filter((s) => !/import-areas/.test(s)).concat(['import-areas: Zameen.com live locations + Graana.com area sitemap, researched 4 Oct 2026']);
fs.writeFileSync(path.join(root, 'data/cities.json'), JSON.stringify(data, null, 1) + '\n');
console.log('added', added, 'names');
