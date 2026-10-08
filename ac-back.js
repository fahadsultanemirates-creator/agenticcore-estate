/* ============================================
   AgenticCore — Back button (shared by agenticcore.estate and
   agenticcorepk.com; keep both copies identical).
   A "←" back button on every page except the home page: in the site
   header just before the logo, or as a small floating "← Back" pill on
   pages without the header (log in, sign up). It goes back to the previous
   page on this site, or to the home page when someone arrived from
   outside (a shared link, Google, WhatsApp).
   ============================================ */
(function () {
  'use strict';
  var path = location.pathname.replace(/\/+$/, '/');
  if (document.body && document.body.getAttribute('data-page') === 'home') return;
  if (/\/(index\.html)?$/.test(path)) return;

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    return l.indexOf('ur') === 0 ? 'ur' : 'en';
  }

  function goBack() {
    var sameSite = false;
    try { sameSite = !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { /* ignore */ }
    if (sameSite && history.length > 1) history.back();
    else location.href = 'index.html';
  }

  var ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';

  function addStyles() {
    var css = document.createElement('style');
    css.textContent =
      '.ac-back{display:inline-flex;align-items:center;justify-content:center;gap:6px;flex:none;border:1.5px solid #CFE0C8;' +
      'background:#FFFFFF;color:#0A1F05;font:600 14px/1 Inter,system-ui,sans-serif;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;padding:0}' +
      '.ac-back:hover{border-color:#68F830;background:#F3FDEE}.ac-back:focus-visible{outline:3px solid #23820E;outline-offset:2px}' +
      '.ac-back svg{width:18px;height:18px;flex:none}[dir=rtl] .ac-back svg{transform:scaleX(-1)}' +
      /* in the site header: a round arrow before the logo */
      '.ac-back-in{width:36px;height:36px;border-radius:50%;margin-inline-end:8px}' +
      '.ac-back-wrap{display:flex;align-items:center;min-width:0}' +
      '.dash-sidebar>.ac-back-wrap{margin-bottom:var(--space-lg,24px)}.dash-sidebar>.ac-back-wrap .nav-logo{margin-bottom:0}' +
      /* pages without a header: a small floating pill */
      '.ac-back-float{position:fixed;left:12px;top:12px;z-index:95;height:38px;padding:0 14px 0 10px;border-radius:999px;box-shadow:0 6px 18px rgba(17,26,16,.16)}' +
      '[dir=rtl] .ac-back-float{left:auto;right:12px;padding:0 10px 0 14px}' +
      /* small phones: keep the logo, arrow and header buttons on one line */
      '@media (max-width:400px){.ac-back-in{width:32px;height:32px;margin-inline-end:6px}.ac-back-in svg{width:16px;height:16px}' +
      '.ac-back-wrap .nav-logo{font-size:1rem;gap:.4rem}.ac-back-wrap .nav-logo-icon{width:28px;height:28px}.ac-back-wrap .nav-logo-img{height:30px;width:auto}}' +
      '@media (max-width:350px){.ac-back-wrap .nav-logo-img{height:26px}}' +
      'body.aca-full-open .ac-back-float{display:none}@media print{.ac-back{display:none}}';
    document.head.appendChild(css);
  }

  function makeButton(inHeader) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ac-back ' + (inHeader ? 'ac-back-in' : 'ac-back-float');
    b.innerHTML = ARROW + (inHeader ? '' : '<span></span>');
    b.addEventListener('click', goBack);
    label(b);
    return b;
  }

  function label(b) {
    var ur = lang() === 'ur';
    var t = b.querySelector('span');
    if (t) t.textContent = ur ? 'واپس' : 'Back';
    b.setAttribute('aria-label', ur ? 'پچھلے صفحے پر واپس' : 'Go back');
    b.title = ur ? 'واپس' : 'Back';
  }

  // Put the arrow just before the logo; the logo and arrow share one group
  // so the header layout (logo left, menu right) stays the same.
  function intoHeader(inner) {
    if (inner.querySelector('.ac-back')) return true;
    var logo = inner.querySelector('.nav-logo');
    if (!logo) return false;
    var wrap = document.createElement('div');
    wrap.className = 'ac-back-wrap';
    logo.parentNode.insertBefore(wrap, logo);
    wrap.appendChild(makeButton(true));
    wrap.appendChild(logo);
    return true;
  }

  function build() {
    addStyles();
    if (document.querySelector('.sheet-bar')) return;          // the print sheet has its own Back link
    var side = document.querySelector('.dash-sidebar');       // Estate dashboards: arrow before the sidebar logo
    if (side && intoHeader(side)) return;
    var host = document.getElementById('site-header');
    var floating = null;
    function fallback() { if (!floating && !document.querySelector('.ac-back-in')) { floating = makeButton(false); document.body.appendChild(floating); } }

    if (!host) { fallback(); }
    else {
      // The header is drawn by script after load (and again on sign-in / language change).
      var check = function () { var inner = host.querySelector('.nav-inner'); if (inner && intoHeader(inner) && floating) { floating.remove(); floating = null; } };
      new MutationObserver(check).observe(host, { childList: true, subtree: true });
      check();
      setTimeout(function () { if (!host.querySelector('.ac-back')) fallback(); }, 3000);
    }
    new MutationObserver(function () { document.querySelectorAll('.ac-back').forEach(label); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  else build();
})();
