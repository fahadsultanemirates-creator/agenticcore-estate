/* ============================================
   AgenticCore Estate — AI feature scaffolding
   ------------------------------------------------
   Three agent-backed features are designed into the
   UI but intentionally NOT wired to a real model yet:
     1. Growth Score      — ai-widget-growth-score
     2. AI Document Check — ai-widget-doc-check
     3. Property Advisor  — floating chat (this file)
   Each widget is inert (disabled inputs / static
   values) and clearly labeled "Coming soon" so the
   agent backend has an obvious place to plug into.
   ============================================ */

function acMountPropertyAdvisor() {
  if (document.getElementById('acAdvisorFab')) return;

  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<button class="ai-chat-fab" id="acAdvisorFab" type="button" aria-label="Property Advisor (coming soon)">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>' +
    '</button>' +
    '<div class="ai-chat-panel" id="acAdvisorPanel">' +
      '<span class="badge badge-gold" data-i18n="coming_soon"></span>' +
      '<h4 style="margin-top:0.6rem;" data-i18n="ai_chat_title"></h4>' +
      '<p data-i18n="ai_chat_sub"></p>' +
      '<textarea disabled data-i18n-ph="ai_chat_placeholder"></textarea>' +
      '<button class="btn btn-secondary btn-sm btn-block" disabled style="margin-top:0.6rem;">—</button>' +
    '</div>';
  document.body.appendChild(wrap);

  document.getElementById('acAdvisorFab').addEventListener('click', function () {
    document.getElementById('acAdvisorPanel').classList.toggle('open');
  });

  if (typeof acInitLanguage === 'function') acInitLanguage();
}

function acGrowthScoreWidget(score) {
  score = (typeof score === 'number') ? score : null;
  return (
    '<div class="ai-widget">' +
      '<span class="badge badge-gold" data-i18n="coming_soon"></span>' +
      '<h4>◆ <span data-i18n="ai_growth_title"></span></h4>' +
      '<p data-i18n="ai_growth_desc"></p>' +
      '<div class="ai-gauge">' + (score !== null ? score + '/100' : '—') + '</div>' +
    '</div>'
  );
}

function acDocCheckWidget(state) {
  state = state || 'not_run';
  const label = state === 'not_run' ? '— not run —' : state;
  return (
    '<div class="ai-widget">' +
      '<span class="badge badge-gold" data-i18n="coming_soon"></span>' +
      '<h4>◆ <span data-i18n="ai_doccheck_title"></span></h4>' +
      '<p data-i18n="ai_doccheck_desc"></p>' +
      '<div class="badge badge-muted" style="margin-top:0.4rem;">' + label + '</div>' +
    '</div>'
  );
}
