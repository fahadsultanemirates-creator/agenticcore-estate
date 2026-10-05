/* ============================================
   AgenticCore Estate — share cards (Free Listing Toolkit)
   Drawn in the browser on <canvas> from the listing's own data, so they
   cost nothing to generate and can never state a fact the listing
   doesn't have. Each card carries a small "Listed on AgenticCore Estate"
   mark and a QR code back to the real listing.
   ============================================ */

const AcShareCards = (function () {
  const GOLD = '#F0CE63', GOLD2 = '#D4AF37', BG = '#071F17', PANEL = '#0C3324', TEXT = '#F4EFE0', MUTED = '#9BB9A9';
  const FORMATS = {
    whatsapp: { w: 1080, h: 1350, label: 'WhatsApp card (4:5)' },
    square: { w: 1080, h: 1080, label: 'Square social post (1:1)' },
    qr: { w: 1080, h: 1080, label: 'QR share card' }
  };
  let qrLibPromise = null;

  function loadQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (!qrLibPromise) {
      qrLibPromise = new Promise(function (ok, fail) {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
        s.onload = ok; s.onerror = fail;
        document.head.appendChild(s);
      });
    }
    return qrLibPromise;
  }

  function listingUrl(l) { return 'https://agenticcore.estate/listing.html?id=' + encodeURIComponent(l.id); }

  function loadImage(src) {
    return new Promise(function (ok) {
      if (!src) return ok(null);
      const img = new Image();
      img.crossOrigin = 'anonymous'; // Supabase storage sends CORS headers; keeps the canvas exportable
      img.onload = function () { ok(img); };
      img.onerror = function () { ok(null); };
      img.src = src;
    });
  }

  function wrap(ctx, text, maxWidth, maxLines) {
    const words = String(text || '').split(/\s+/);
    const lines = []; let line = '';
    words.forEach(function (w) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…'; }
    return lines;
  }

  function coverImage(ctx, img, x, y, w, h) {
    const r = Math.max(w / img.width, h / img.height);
    const iw = img.width * r, ih = img.height * r;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    ctx.restore();
  }

  function drawQR(ctx, url, x, y, size) {
    if (!window.qrcode) return;
    const qr = window.qrcode(0, 'M'); qr.addData(url); qr.make();
    const n = qr.getModuleCount(); const cell = size / (n + 4);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#071F17';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) ctx.fillRect(x + (c + 2) * cell, y + (r + 2) * cell, Math.ceil(cell), Math.ceil(cell));
  }

  function drawContain(ctx, img, x, y, w, h) {
    const r = Math.min(w / img.width, h / img.height);
    const dw = img.width * r, dh = img.height * r;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  function fit(ctx, text, max) {
    text = String(text || '');
    if (ctx.measureText(text).width <= max) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text + '…';
  }
  function price(l) { return acFormatPKR(l.price) + (l.type === 'rent' && l.price > 0 ? ' / month' : ''); }
  function specs(l) {
    const s = [];
    if (Number(l.size_marla) > 0) s.push(l.size_marla + ' ' + acSizeUnitLabel(l.size_unit || 'marla'));
    if (Number(l.beds) > 0) s.push(l.beds + ' Bed');
    if (Number(l.baths) > 0) s.push(l.baths + ' Bath');
    s.push(acPropertyTypeLabel(l.property_type));
    return s;
  }

  // opts.brand = { name, logo } — the agency/professional the listing is linked
  // to (links are validated by the database, so only the owner's own agency or
  // an agency they actively belong to can appear here).
  async function draw(canvas, l, format, opts) {
    const f = FORMATS[format] || FORMATS.whatsapp;
    const brand = opts && opts.brand && opts.brand.name ? opts.brand : null;
    const brandLogo = brand && brand.logo ? await loadImage(brand.logo) : null;
    canvas.width = f.w; canvas.height = f.h;
    const ctx = canvas.getContext('2d');
    await loadQrLib().catch(function () {});
    const img = await loadImage(l.photos && l.photos[0]);
    const pad = 64;

    ctx.fillStyle = BG; ctx.fillRect(0, 0, f.w, f.h);

    if (format === 'qr') {
      ctx.fillStyle = PANEL; ctx.fillRect(40, 40, f.w - 80, f.h - 80);
      ctx.fillStyle = GOLD; ctx.font = '600 40px Inter, Arial, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(l.type === 'rent' ? 'FOR RENT' : 'FOR SALE', f.w / 2, 130);
      ctx.fillStyle = TEXT; ctx.font = '700 54px "Space Grotesk", Inter, Arial, sans-serif';
      wrap(ctx, l.title, f.w - 200, 2).forEach(function (ln, i) { ctx.fillText(ln, f.w / 2, 210 + i * 64); });
      drawQR(ctx, listingUrl(l), f.w / 2 - 240, 340, 480);
      ctx.fillStyle = GOLD; ctx.font = '700 60px "Space Grotesk", Inter, Arial, sans-serif'; ctx.fillText(price(l), f.w / 2, 900);
      ctx.fillStyle = MUTED; ctx.font = '400 34px Inter, Arial, sans-serif'; ctx.fillText('Scan to view on AgenticCore Estate', f.w / 2, 970);
      if (brand) { ctx.fillStyle = TEXT; ctx.font = '600 32px Inter, Arial, sans-serif'; ctx.fillText(fit(ctx, 'By ' + brand.name, f.w - 160), f.w / 2, 1015); }
      ctx.textAlign = 'left';
      return canvas;
    }

    const photoH = Math.round(f.h * (format === 'square' ? 0.5 : 0.52));
    if (img) coverImage(ctx, img, 0, 0, f.w, photoH);
    else { const g = ctx.createLinearGradient(0, 0, f.w, photoH); g.addColorStop(0, '#0C3324'); g.addColorStop(1, '#103E2C'); ctx.fillStyle = g; ctx.fillRect(0, 0, f.w, photoH); }
    const fade = ctx.createLinearGradient(0, photoH - 160, 0, photoH);
    fade.addColorStop(0, 'rgba(7,31,23,0)'); fade.addColorStop(1, BG);
    ctx.fillStyle = fade; ctx.fillRect(0, photoH - 160, f.w, 160);

    // purpose tag
    ctx.fillStyle = GOLD2; ctx.fillRect(pad, pad, 250, 64);
    ctx.fillStyle = '#16250D'; ctx.font = '700 32px Inter, Arial, sans-serif';
    ctx.fillText(l.type === 'rent' ? 'FOR RENT' : 'FOR SALE', pad + 26, pad + 44);

    let y = photoH + 30;
    ctx.fillStyle = GOLD; ctx.font = '700 76px "Space Grotesk", Inter, Arial, sans-serif';
    ctx.fillText(price(l), pad, y + 60); y += 110;
    ctx.fillStyle = TEXT; ctx.font = '700 46px "Space Grotesk", Inter, Arial, sans-serif';
    wrap(ctx, l.title, f.w - pad * 2, format === 'square' ? 1 : 2).forEach(function (ln) { ctx.fillText(ln, pad, y + 40); y += 58; });
    ctx.fillStyle = MUTED; ctx.font = '400 36px Inter, Arial, sans-serif';
    wrap(ctx, l.area + ', ' + l.city, f.w - pad * 2, 1).forEach(function (ln) { ctx.fillText(ln, pad, y + 36); y += 52; });

    // spec chips
    y += 18; let x = pad;
    ctx.font = '600 32px Inter, Arial, sans-serif';
    specs(l).forEach(function (s) {
      const w = ctx.measureText(s).width + 44;
      if (x + w > f.w - pad) return;
      ctx.strokeStyle = '#1D4835'; ctx.lineWidth = 3; ctx.strokeRect(x, y, w, 62);
      ctx.fillStyle = TEXT; ctx.fillText(s, x + 22, y + 42);
      x += w + 16;
    });

    // footer: brand + QR
    const qrSize = format === 'square' ? 170 : 200;
    const fy = f.h - qrSize - pad;
    drawQR(ctx, listingUrl(l), f.w - pad - qrSize, fy, qrSize);
    // footer text block (left of the QR). With a linked agency/professional the
    // two lines become "Listed by <name>" + "on AgenticCore Estate · scan to view".
    const textW = f.w - pad * 2 - qrSize - 24;
    let tx = pad;
    if (brand && brandLogo) {
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(pad, fy + qrSize - 104, 96, 96);
      drawContain(ctx, brandLogo, pad + 6, fy + qrSize - 98, 84, 84);
      tx = pad + 116;
    }
    ctx.fillStyle = TEXT; ctx.font = '600 34px Inter, Arial, sans-serif';
    ctx.fillText(fit(ctx, brand ? 'Listed by ' + brand.name : 'Listed on AgenticCore Estate', textW - (tx - pad)), tx, fy + qrSize - 60);
    ctx.fillStyle = MUTED; ctx.font = '400 30px Inter, Arial, sans-serif';
    ctx.fillText(fit(ctx, brand ? 'on AgenticCore Estate · scan to view' : 'agenticcore.estate · scan to view', textW - (tx - pad)), tx, fy + qrSize - 14);
    return canvas;
  }

  // Captions built only from listing fields. Roman Urdu written by hand as
  // templates — never machine-translated.
  function captions(l, opts) {
    const url = listingUrl(l);
    const by = opts && opts.brand && opts.brand.name ? opts.brand.name : '';
    const size = Number(l.size_marla) > 0 ? l.size_marla + ' ' + acSizeUnitLabel(l.size_unit || 'marla') + ' ' : '';
    const type = acPropertyTypeLabel(l.property_type);
    const rooms = [Number(l.beds) > 0 ? l.beds + ' bed' : '', Number(l.baths) > 0 ? l.baths + ' bath' : ''].filter(Boolean).join(', ');
    const en = (l.type === 'rent' ? '🏠 For rent: ' : '🏠 For sale: ') + size + type + ' in ' + l.area + ', ' + l.city + '\n' +
      (rooms ? rooms + '\n' : '') + '💰 ' + price(l) + '\n' +
      (by ? 'Listed by ' + by + '\n' : '') + 'Details & photos: ' + url + '\n#AgenticCoreEstate #' + String(l.city).replace(/\s/g, '') + 'Property';
    const roman = (l.type === 'rent' ? '🏠 Kiraye ke liye: ' : '🏠 Baraye farokht: ') + size + type + ', ' + l.area + ', ' + l.city + '\n' +
      (rooms ? rooms + '\n' : '') + '💰 ' + (l.type === 'rent' ? 'Kiraya: ' : 'Demand: ') + price(l) + '\n' +
      (by ? 'Listed by: ' + by + '\n' : '') + 'Tafseelat aur tasaveer: ' + url;
    return { en: en, roman: roman };
  }

  return { FORMATS: FORMATS, draw: draw, captions: captions, listingUrl: listingUrl };
})();
