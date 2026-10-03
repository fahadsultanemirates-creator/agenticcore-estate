/* AgenticCore assistants — loader (shared by agenticcore.estate and agenticcorepk.com).
   Shows one floating "AI help" button and wires any [data-aca-open] button.
   The full assistant (ac-assistant.js + .css) loads only when first opened.
   <script src="ac-assistant-boot.js" data-site="estate|pk" data-endpoint="…/api/assistant"
           data-js="ac-assistant.js" data-css="ac-assistant.css" defer></script> */
(function () {
  var me = document.currentScript;
  if (!me || window.AcAssistantBoot) return;
  var cfg = {
    site: me.getAttribute('data-site') === 'pk' ? 'pk' : 'estate',
    endpoint: me.getAttribute('data-endpoint') || '/api/assistant',
    js: me.getAttribute('data-js') || 'ac-assistant.js',
    css: me.getAttribute('data-css') || 'ac-assistant.css'
  };
  var loading = null;
  function load() {
    if (window.AcAssistant) return Promise.resolve(window.AcAssistant);
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = cfg.css; document.head.appendChild(l);
      var s = document.createElement('script'); s.src = cfg.js; s.async = true;
      s.onload = function () { window.AcAssistant ? resolve(window.AcAssistant) : reject(new Error('load')); };
      s.onerror = function () { loading = null; reject(new Error('load')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function open(opts) {
    var fab = document.getElementById('acaFab');
    if (fab) fab.setAttribute('aria-busy', 'true');
    load().then(function (A) { if (fab) fab.removeAttribute('aria-busy'); A.open(Object.assign({}, cfg, opts || {})); })
      .catch(function () { if (fab) fab.removeAttribute('aria-busy'); });
  }
  function ur() { return document.documentElement.lang === 'ur'; }
  function label(fab) {
    fab.querySelector('.aca-fab-text').textContent = ur() ? 'AI مدد' : 'Ask AI';
    fab.setAttribute('aria-label', ur() ? 'AgenticCore AI اسسٹنٹ کھولیں' : 'Open the AgenticCore AI assistant');
  }
  var FAB_CSS = '.aca-fab { position: fixed; right: 18px; bottom: 86px; z-index: 95; display: inline-flex; align-items: center; gap: .45rem; min-height: 48px; padding: 0 1rem 0 .85rem; border: 1px solid rgba(212,175,55,.55); border-radius: 999px; cursor: pointer; background: #0C3324; color: #F4EFE0; font: 600 .95rem/1 inherit; box-shadow: 0 10px 28px rgba(0,0,0,.35); } .aca-fab svg { width: 22px; height: 22px; color: #F0CE63; } .aca-fab:hover, .aca-fab:focus-visible { border-color: #F0CE63; } .aca-fab:focus-visible { outline: 3px solid #F0CE63; outline-offset: 3px; } .aca-fab[aria-busy="true"] { opacity: .7; } html[dir="rtl"] .aca-fab { right: auto; left: 18px; padding: 0 .85rem 0 1rem; } .aca-fab-pk { bottom: 94px; } body.aca-open .aca-fab { display: none; } @media (max-width: 600px) { .aca-fab { right: 12px; bottom: 76px; min-height: 46px; padding: 0 .85rem 0 .7rem; } html[dir="rtl"] .aca-fab { left: 12px; } .aca-fab-pk { bottom: calc(var(--mobile-bar-h, 56px) + 12px); } } @media print { .aca-fab { display: none !important; } }';
  function init() {
    var st = document.createElement('style'); st.textContent = FAB_CSS; document.head.appendChild(st);
    var fab = document.createElement('button');
    fab.type = 'button'; fab.id = 'acaFab'; fab.className = 'aca-fab' + (cfg.site === 'pk' ? ' aca-fab-pk' : '');
    fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-expanded', 'false');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M9 11h.01M12 11h.01M15 11h.01"/></svg><span class="aca-fab-text"></span>';
    label(fab);
    fab.addEventListener('click', function () { open({}); });
    document.body.appendChild(fab);
    document.body.classList.add('has-aca');
    new MutationObserver(function () { label(fab); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    // Any page button can open a specific assistant: <button data-aca-open="amaan" data-aca-quick="amaan_find">
    document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest && e.target.closest('[data-aca-open]');
      if (!b) return;
      e.preventDefault();
      open({ bot: b.getAttribute('data-aca-open') === 'amaan' ? 'amaan' : 'guide', quick: b.getAttribute('data-aca-quick') || null });
    });
  }
  window.AcAssistantBoot = { open: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
