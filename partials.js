/* ============================================
   AgenticCore Estate — shared header / footer
   Injected into <div id="site-header"></div> and
   <div id="site-footer"></div> so nav/footer markup
   (and auth-aware state + language toggle) live in
   one place across ~20 pages.
   Set <body data-page="buy"> to highlight the active
   nav link.
   ============================================ */

const AC_LOGO_SVG = '<img src="images/agenticcore-icon.png" alt="AgenticCore" class="nav-logo-icon">';

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
    // One dashboard for every account type (modules depend on what the account manages).
    const dashHref = user.role === 'admin' ? 'admin-dashboard.html' : 'my.html';
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
        '<a href="index.html" class="nav-logo">' + AC_LOGO_SVG + 'AgenticCore<span class="brand-suffix">Estate</span></a>' +
        '<div class="nav-right" id="navRight">' +
          '<div class="nav-links">' +
            // Properties carries Buy / Rent / List free as a submenu (dropdown on
            // desktop, indented under Properties in the mobile menu).
            '<div class="nav-group' + (['properties', 'buy', 'rent', 'sell'].indexOf(document.body.getAttribute('data-page')) >= 0 ? ' active' : '') + '">' +
              acNavLink('properties.html', 'properties', 'nav_properties') +
              '<button type="button" class="nav-sub-toggle" aria-expanded="false" aria-controls="acNavSubProps" data-i18n-aria="nav_properties_menu" aria-label="Properties menu">' +
                '<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"/></svg></button>' +
              '<div class="nav-sub" id="acNavSubProps">' +
                acNavLink('buy.html', 'buy', 'nav_buy') +
                acNavLink('rent.html', 'rent', 'nav_rent') +
                acNavLink('sell.html', 'sell', 'nav_list_free') +
              '</div>' +
            '</div>' +
            acNavLink('projects.html', 'projects', 'nav_projects') +
            acNavLink('professionals.html', 'professionals', 'nav_professionals') +
            acNavLink('agencies.html', 'agencies', 'nav_agencies') +
            acNavLink('builders.html', 'builders', 'nav_builders') +
          '</div>' +
          '<div class="nav-cta">' +
            '<button class="lang-toggle" id="acLangToggle" type="button" aria-label="Toggle language">' +
              '<span class="lang-toggle-label">اردو</span>' +
            '</button>' +
            ctaHtml +
          '</div>' +
        '</div>' +
        '<button class="nav-menu-toggle" id="acNavMenuToggle" type="button" aria-label="Toggle menu" aria-expanded="false">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
    '</nav>';

  const langBtn = document.getElementById('acLangToggle');
  if (langBtn) langBtn.addEventListener('click', acToggleLanguage);

  const menuBtn = document.getElementById('acNavMenuToggle');
  const navRight = document.getElementById('navRight');
  if (menuBtn && navRight) {
    menuBtn.addEventListener('click', function () {
      const open = navRight.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navRight.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        navRight.classList.remove('open');
        menuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const subBtn = el.querySelector('.nav-sub-toggle');
  if (subBtn) {
    const group = subBtn.parentNode;
    subBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = group.classList.toggle('open');
      subBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!group.contains(e.target)) { group.classList.remove('open'); subBtn.setAttribute('aria-expanded', 'false'); }
    });
    group.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { group.classList.remove('open'); subBtn.setAttribute('aria-expanded', 'false'); subBtn.focus(); }
    });
  }

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
            '<a href="index.html" class="nav-logo">' + AC_LOGO_SVG + 'AgenticCore<span class="brand-suffix">Estate</span></a>' +
            '<p data-i18n="footer_tagline"></p>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_explore"></h5>' +
            '<ul>' +
              '<li><a href="properties.html" data-i18n="nav_properties"></a></li>' +
              '<li><a href="projects.html" data-i18n="nav_projects"></a></li>' +
              '<li><a href="professionals.html" data-i18n="nav_professionals"></a></li>' +
              '<li><a href="agencies.html" data-i18n="nav_agencies"></a></li>' +
              '<li><a href="builders.html" data-i18n="nav_builders"></a></li>' +
              '<li><a href="pricing.html" data-i18n="nav_launch"></a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_developers"></h5>' +
            '<ul>' +
              '<li><a href="developer-corner.html" data-i18n="nav_developer"></a></li>' +
              '<li><a href="sell.html" data-i18n="nav_list_free"></a></li>' +
              '<li><a href="developer-apply.html" data-i18n="mk_apply_projects"></a></li>' +
              '<li><a href="admin-login.html" data-i18n="nav_admin"></a></li>' +
            '</ul>' +
          '</div>' +
          '<div class="footer-col">' +
            '<h5 data-i18n="footer_company"></h5>' +
            '<ul>' +
              '<li><a href="buy.html" data-i18n="nav_buy"></a></li>' +
              '<li><a href="rent.html" data-i18n="nav_rent"></a></li>' +
              '<li><a href="business-pool.html" data-i18n="nav_business_pool"></a></li>' +
              '<li><a href="referral.html" data-i18n="nav_referrals"></a></li>' +
            '</ul>' +
          '</div>' +
        '</div>' +
        (typeof acEcosystemHTML === 'function' ? '<div class="footer-eco">' + acEcosystemHTML('compact') + '</div>' : '') +
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
