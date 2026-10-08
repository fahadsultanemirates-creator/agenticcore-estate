/* AgenticCore Estate — the floating "Amaan" button on every page (not on Amaan's
   own page or the admin pages). A plain link to amaan.html, so it costs nothing
   until it's pressed; the chat itself lives on that page. */
(function () {
  if (window.AcAmaanFloat || !document.body) return;
  window.AcAmaanFloat = true;
  if (/(^|\/)(amaan|admin-[a-z-]+|sheet)\.html$/.test(location.pathname)) return;

  var CSS = '.ac-amaan-float { position: fixed; right: 18px; bottom: 18px; z-index: 96; display: inline-flex; align-items: center; gap: .55rem; min-height: 60px; padding: 0 1.6rem 0 1.25rem;' +
    ' border-radius: 999px; background: #68F830; color: #0A1F05; font: 700 1.15rem/1 Inter, system-ui, sans-serif; letter-spacing: .01em; text-decoration: none;' +
    ' box-shadow: 0 0 0 7px rgba(104,248,48,.22), 0 10px 30px rgba(17,26,16,.28), 0 0 26px rgba(104,248,48,.45); }' +
    ' .ac-amaan-float svg { width: 26px; height: 26px; flex: 0 0 auto; }' +
    ' .ac-amaan-float:hover { background: #8CFF5C; color: #0A1F05; }' +
    ' .ac-amaan-float:focus-visible { outline: 3px solid #0A1F05; outline-offset: 4px; }' +
    ' html[dir="rtl"] .ac-amaan-float { right: auto; left: 18px; padding: 0 1.25rem 0 1.6rem; }' +
    ' html[lang="ur"] .ac-amaan-float span { font-family: "Noto Nastaliq Urdu", "Noto Naskh Arabic", serif; font-size: 1.2rem; line-height: 1.6; }' +
    ' body.has-amaan-float .ac-wa-float { bottom: 98px; }' +
    ' body.ac-amaan-pad { padding-bottom: 96px; }' +
    ' body.aca-open .ac-amaan-float { display: none; }' +
    ' @media (max-width: 600px) { .ac-amaan-float { right: 14px; bottom: 14px; min-height: 56px; font-size: 1.1rem; padding: 0 1.4rem 0 1.1rem; } html[dir="rtl"] .ac-amaan-float { left: 14px; } body.has-amaan-float .ac-wa-float { bottom: 90px; right: 14px; } }' +
    ' @media (prefers-reduced-motion: no-preference) { .ac-amaan-float { transition: background-color .15s, transform .15s; } .ac-amaan-float:hover { transform: translateY(-2px); } }' +
    ' @media print { .ac-amaan-float { display: none !important; } }';

  function ur() { return document.documentElement.lang === 'ur'; }
  function label(a) {
    a.querySelector('span').textContent = ur() ? 'امان' : 'Amaan';
    a.setAttribute('aria-label', ur() ? 'امان سے بات کریں — AI پراپرٹی اسسٹنٹ' : 'Talk to Amaan — AI property assistant');
  }
  function init() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    var a = document.createElement('a');
    a.className = 'ac-amaan-float'; a.href = 'amaan.html';
    a.setAttribute('data-track', 'assistant_opened'); a.setAttribute('data-channel', 'amaan_float');
    a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/><path d="M5 2.5l.5 1.5L7 4.5l-1.5.5L5 6.5l-.5-1.5L3 4.5l1.5-.5z"/></svg><span></span>';
    label(a);
    document.body.appendChild(a);
    document.body.classList.add('has-amaan-float');
    new MutationObserver(function () { label(a); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    // pages without the footer (dashboards, forms): keep the last controls clear of the button
    window.addEventListener('load', function () { if (!document.querySelector('footer')) document.body.classList.add('ac-amaan-pad'); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
