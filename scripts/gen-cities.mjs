// Writes the browser copies of data/cities.json:
//   ac-cities.js (this site) and ../Agenticcore-pk/js/ac-cities.js (when present).
// Run after editing data/cities.json:  node scripts/gen-cities.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data/cities.json'), 'utf8'));
const slim = { launch_at: data.launch_at, cities: data.cities.map((c) => ({ name: c.name, ur: c.ur, launch_at: c.launch_at, areas: c.areas })),
  shared: data.shared.map((s) => ({ name: s.name, cities: s.cities })) };

export function browserFile() {
  return `// GENERATED from data/cities.json by scripts/gen-cities.mjs — do not edit by hand.
// Cities we serve, their areas, and the launch date check: a city whose
// launch_at is still ahead shows a small "Launching 6 Oct" label; from that
// moment (Pakistan time) the label disappears by itself — no manual switch.
var AC_CITIES = ${JSON.stringify(slim)};
function acCityInfo(name) { for (var i = 0; i < AC_CITIES.cities.length; i++) if (AC_CITIES.cities[i].name === name) return AC_CITIES.cities[i]; return null; }
function acCityLaunching(name, now) { var c = acCityInfo(name); return Boolean(c && c.launch_at && (now || new Date()) < new Date(c.launch_at)); }
function acLaunchDay(lang) { var d = new Date(AC_CITIES.launch_at); var day = d.toLocaleDateString('en-GB', { timeZone: 'Asia/Karachi', day: 'numeric' });
  return lang === 'ur' ? day + ' اکتوبر' : day + ' Oct'; }
function acCityLabel(name, lang) {
  if (!acCityLaunching(name)) return name;
  return name + ' · ' + (lang === 'ur' ? acLaunchDay('ur') + ' سے' : 'Launching ' + acLaunchDay('en'));
}
function acCityAreas(name) {
  var c = acCityInfo(name), out = c ? c.areas.slice() : [];
  AC_CITIES.shared.forEach(function (s) { if (s.cities.indexOf(name) >= 0 && out.indexOf(s.name) < 0) out.push(s.name); });
  return out;
}
function acAnyCityLaunching() { return AC_CITIES.cities.some(function (c) { return acCityLaunching(c.name); }); }
function acUiLang() { return document.documentElement.lang === 'ur' ? 'ur' : 'en'; }
// i18n: after the launch moment every "<key>_live" text replaces "<key>"
// (e.g. "Coming on 6 October" → "Now live"), with no redeploy.
function acApplyLaunchCopy(dict) {
  if (acAnyCityLaunching()) return dict;
  Object.keys(dict).forEach(function (k) { if (/_live$/.test(k)) dict[k.slice(0, -5)] = dict[k]; });
  return dict;
}
// <option>s for a city <select>: value is the city name, the text carries the label.
function acCityOptionsHTML(names, selected) {
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  return names.map(function (n) { return '<option value="' + esc(n) + '"' + (n === selected ? ' selected' : '') + '>' + esc(acCityLabel(n, acUiLang())) + '</option>'; }).join('');
}
// Elements marked data-city-launch="Lahore" show that city's "Launching 6 Oct" label, and hide from launch.
function acRefreshLaunchLabels() {
  document.querySelectorAll('[data-city-launch]').forEach(function (el) {
    var on = acCityLaunching(el.getAttribute('data-city-launch'));
    el.hidden = !on;
    if (on) el.textContent = acUiLang() === 'ur' ? acLaunchDay('ur') + ' سے' : 'Launching ' + acLaunchDay('en');
  });
  document.querySelectorAll('select[data-city-select] option').forEach(function (o) {
    if (o.value && acCityInfo(o.value)) o.textContent = acCityLabel(o.value, acUiLang());
  });
  document.querySelectorAll('[data-launch-only]').forEach(function (el) { el.hidden = !acAnyCityLaunching(); });
  document.querySelectorAll('[data-live-only]').forEach(function (el) { el.hidden = acAnyCityLaunching(); });
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', acRefreshLaunchLabels); else acRefreshLaunchLabels();
}
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = browserFile();
  fs.writeFileSync(path.join(root, 'ac-cities.js'), out);
  const pk = path.join(root, '..', 'Agenticcore-pk', 'js');
  if (fs.existsSync(pk)) fs.writeFileSync(path.join(pk, 'ac-cities.js'), out);
  console.log('ac-cities.js written' + (fs.existsSync(pk) ? ' (+ PK js/ac-cities.js)' : ''));
}
