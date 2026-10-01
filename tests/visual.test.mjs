// Run: node --test tests/*.test.mjs
// Visual asset pass: the artwork on the page and the share image are the sizes the HTML says,
// stay light, carry EN + UR alt text, and the important ideas also exist as real HTML text.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (f) => fs.readFileSync(new URL(f, root), 'utf8');
const html = read('index.html');

function imageSize(file) {
  const b = fs.readFileSync(new URL(file, root));
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') { const n = b.readUInt32LE(21); return { w: 1 + (n & 0x3fff), h: 1 + ((n >> 14) & 0x3fff) }; }
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc3) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  throw new Error('unknown image format: ' + file);
}

function i18n() {
  const ctx = { window: {}, localStorage: { getItem() {}, setItem() {} }, document: { querySelectorAll: () => [], documentElement: { setAttribute() {} }, addEventListener() {} } };
  const fn = new Function('window', 'localStorage', 'document', read('i18n.js') + '; return AC_I18N;');
  return fn(ctx.window, ctx.localStorage, ctx.document);
}

test('ecosystem artwork: real sizes match the HTML, light files, same aspect for srcset', () => {
  const full = imageSize('images/estate-pk-ecosystem.webp');
  const small = imageSize('images/estate-pk-ecosystem-960.webp');
  const mobile = imageSize('images/estate-pk-ecosystem-mobile.webp');
  assert.deepEqual(full, { w: 1672, h: 512 });
  assert.match(html, /estate-pk-ecosystem-960\.webp 960w, images\/estate-pk-ecosystem\.webp 1672w"[^>]*width="1672" height="512"/);
  assert.equal(small.w, 960);
  assert.ok(Math.abs(small.w / small.h - full.w / full.h) < 0.01, 'srcset copies must keep the aspect ratio');
  assert.match(html, new RegExp('estate-pk-ecosystem-mobile\\.webp" width="' + mobile.w + '" height="' + mobile.h + '"'));
  for (const f of ['images/estate-pk-ecosystem.webp', 'images/estate-pk-ecosystem-960.webp', 'images/estate-pk-ecosystem-mobile.webp']) {
    assert.ok(fs.statSync(new URL(f, root)).size <= 200 * 1024, f + ' should be ≤ 200 KB');
  }
  assert.match(html, /class="h2-eco-art"[\s\S]*?loading="lazy"/, 'below-the-fold artwork is lazy-loaded');
});

test('ecosystem artwork has EN + UR alt text and its steps exist as HTML text', () => {
  const D = i18n();
  assert.match(html, /data-i18n-alt="h2_eco_art_alt"/);
  assert.match(read('i18n.js'), /data-i18n-alt/);
  for (const k of ['h2_eco_art_alt', 'h2_eco_s1t', 'h2_eco_s1', 'h2_eco_s2t', 'h2_eco_s2', 'h2_eco_s3t', 'h2_eco_s3', 'h2_eco_s4t', 'h2_eco_s4']) {
    assert.ok(D.en[k] && D.ur[k], k + ' needs English and Urdu');
    assert.match(html, new RegExp('data-i18n(-alt)?="' + k + '"'), k + ' must be used on the page');
  }
  // no results promises in the new copy
  const copy = ['h2_eco_s1', 'h2_eco_s2', 'h2_eco_s3', 'h2_eco_s4'].map((k) => D.en[k]).join(' ');
  assert.ok(!/guarantee|more leads|more inquiries|verified|roi/i.test(copy), 'step copy must not promise results');
});

test('share image is a real 1200x630 Estate card and the meta points to it', () => {
  assert.deepEqual(imageSize('images/og-estate.jpg'), { w: 1200, h: 630 });
  assert.ok(fs.statSync(new URL('images/og-estate.jpg', root)).size <= 200 * 1024);
  assert.match(html, /<meta property="og:image" content="https:\/\/agenticcore\.estate\/images\/og-estate\.jpg">/);
  assert.match(html, /og:image:width" content="1200">\s*<meta property="og:image:height" content="630">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/agenticcore\.estate\/images\/og-estate\.jpg">/);
});

test('every image referenced by the homepage exists', () => {
  for (const m of html.matchAll(/(?:src|srcset)="([^"]+)"/g)) {
    for (const part of m[1].split(',')) {
      const f = part.trim().split(/\s+/)[0];
      if (/^images\//.test(f)) assert.ok(fs.existsSync(new URL(f, root)), f + ' is missing');
    }
  }
});
