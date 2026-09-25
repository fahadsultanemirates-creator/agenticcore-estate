/* ============================================
   AgenticCore Estate — shared header / footer
   Injected into <div id="site-header"></div> and
   <div id="site-footer"></div> so nav/footer markup
   (and auth-aware state + language toggle) live in
   one place across ~20 pages.
   Set <body data-page="buy"> to highlight the active
   nav link.
   ============================================ */

const AC_LOGO_SVG = '<svg viewBox="0 0 100 100" fill="none"><polygon points="50,8 88,29 88,71 50,92 12,71 12,29" stroke="#22D3EE" stroke-width="4"/><polygon points="50,28 70,40 70,60 50,72 30,60 30,40" stroke="#3B82F6" stroke-width="3"/></svg>';

function acNavLink(href, page, key) {
  const active = document.body.getAttribute('data-page') === page ? ' active' : '';
  return '<a href="' + href + '" class="' + active.trim() + '" data-i18n="' + key + '"></a>';
}

async function acRenderHeader() {
  const el = document.getElementById('site-header');
  if (!el) return;
  const user = (typeof AcDB !== 'undefined') ? await AcDB.currentUser() : null;

  let ctaHtml;
  if (user) {
    const dashHref = user.role === 'admin' ? 'admin-dashboard.html'
      : user.role === 'developer' ? 'developer-dashboard.html'
      : 'dashboard.html';
    ctaHtml =
      '<a href="' + dashHref + '" class="btn btn-secondary btn-sm" data-i18n="nav_dashboard"></a>' +
      '<button class="btn btn-primary btn-sm" id="acLogoutBtn" data-i18n="nav_logout"></button>';
  } else {
    ctaHtml =
      '<a href="login.html" class="btn btn-secondary btn-sm" data-i18n="nav_login"></a>' +
      '<a href="signup.html" class="btn btn-primary btn-sm" data-i18n="nav_signup"></a>';
  }

  el.innerHTML =
    '<nav class="nav" id="nav">' +
      '<div class="container nav-inner">' +
        '<a href="index.html" class="nav-logo">' + AC_LOGO_SVG + 'Agentic<span class="brand-suffix">Estate</span></a>' +
        '<div class="nav-links">' +
          acNavLink('buy.html', 'buy', 'nav_buy') +
          acNavLink('rent.html', 'rent', 'nav_rent') +
          acNavLink('sell.html', 'sell', 'nav_sell') +
          acNavLink('developer-corner.html', 'developer', 'nav_developer') +
          acNavLink('business-pool.html', 'business-pool', 'nav_business_pool') +
          acNavLink('referral.html', 'referral', 'nav_referrals') +
          acNavLink('pricing.html', 'pricing', 'nav_pricing') +
        '</div>' +
        '<div class="nav-cta">' +
          '<button class="lang-toggle" id="acLangToggle" type="button" aria-label="Toggle language">' +
            '<span class="lang-toggle-label">اردو</span>' +
          '</button>' +
          ctaHtml +
        '</div>' +
      '</div>' +
    '</nav>';

  const langBtn = document.getElementById('acLangToggle');
  if (langBtn) langBtn.addEventListener('click', acToggleLanguage);

  const logoutBtn = document.getElementById('acLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async function () {
      await AcDB.logOut();
      window.location.href = 'index.html';
    });
  }

  window.addEventListener('scroll', function () {
    const nav = document.getElementById('nav');
    if (!nav) return;
    if (window.scrollY > 10) nav.classList.add('scrolled'); else nav.classList.remove('scrolled');
  });
}

function acRenderFooter() {
  const el = document.getElementById('site-footer');
  if (!el) return;
  el.innerHTML =
    '<footer class="footer">' +
      '<div class="container">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<a href="index.html" class="nav-logo">' + AC_LOGO_SVG + 'Agentic<span class="brand-suffix">Estate</span></a>' +
            '<p data-i18n="footer_tagline"></p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_explore"></h5>' +
            '<ul>' +
              '<li><a href="buy.html" data-i18n="nav_buy"></a></li>' +
              '<li><a href="rent.html" data-i18n="nav_rent"></a></li>' +
              '<li><a href="sell.html" data-i18n="nav_sell"></a></li>' +
              '<li><a href="pricing.html" data-i18n="nav_pricing"></a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_developers"></h5>' +
            '<ul>' +
              '<li><a href="developer-corner.html" data-i18n="nav_developer"></a></li>' +
              '<li><a href="developer-packages.html">Project Packages</a></li>' +
              '<li><a href="developer-apply.html">Apply as developer</a></li>' +
              '<li><a href="admin-login.html" data-i18n="nav_admin"></a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_company"></h5>' +
            '<ul>' +
              '<li><a href="business-pool.html" data-i18n="nav_business_pool"></a></li>' +
              '<li><a href="referral.html" data-i18n="nav_referrals"></a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© 2026 AgenticCore Estate. <span data-i18n="footer_rights"></span></span>' +
          '<span>An AgenticCore Company</span>' +
        '</div>' +
      '</div>' +
    '</footer>';
}

document.addEventListener('DOMContentLoaded', async function () {
  await acRenderHeader();
  acRenderFooter();
  if (typeof acInitLanguage === 'function') acInitLanguage();
});
