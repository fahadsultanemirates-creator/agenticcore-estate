/* ============================================
   AgenticCore Estate — shared header / footer
   Injected into <div id="site-header"></div> and
   <div id="site-footer"></div> so nav/footer markup
   (and auth-aware state + language toggle) live in
   one place across ~20 pages.
   Set <body data-page="buy"> to highlight the active
   nav link.
   ============================================ */

// Header and footer (both light): the logo on a dark tile + dark name. AC_LOGO_DARK: the glowing logo for dark backgrounds.
const AC_LOGO_SVG = '<img src="images/agenticcore-logo-light.png" alt="AgenticCore.estate" class="nav-logo-img" width="187" height="40">';
const AC_LOGO_DARK = '<img src="images/agenticcore-logo.png" alt="AgenticCore.estate" class="nav-logo-img" width="187" height="40">';

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
        '<a href="index.html" class="nav-logo nav-logo-slogan">' + AC_LOGO_SVG + '<span class="nav-slogan" data-i18n="h2_slogan">Khwabon se ghar tak</span></a>' +
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
    '<footer class="footer theme-mint">' +
      '<div class="container">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<a href="index.html" class="nav-logo">' + AC_LOGO_SVG + '</a>' +
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
        (typeof acContactHTML === 'function' ? '<div class="footer-connect">' +
          '<div><h5 data-i18n="footer_contact_h"></h5>' + acContactHTML() + '</div>' +
          '<div><h5 data-i18n="footer_follow_h"></h5>' + acSocialHTML() + '</div>' +
        '</div>' : '') +
        (typeof acEcosystemHTML === 'function' ? '<div class="footer-eco">' + acEcosystemHTML('compact') + '</div>' : '') +
        '<div class="footer-bottom">' +
          '<span>© 2026 AgenticCore Estate. <span data-i18n="footer_rights"></span></span>' +
          '<span>An AgenticCore Company</span>' +
        '</div>' +
      '</div>' +
    '</footer>';
}

// Floating "Chat on WhatsApp" with the AgenticCore team (public pages only —
// not on dashboards, forms or print pages, where it would sit over controls).
function acRenderWhatsAppFloat() {
  if (typeof AC_CONTACT === 'undefined' || document.body.hasAttribute('data-no-float')) return;
  if (/(^|\/)(my|admin-[a-z-]+|sell|post-project|toolkit|sheet|login|signup|developer-apply)\.html$/.test(location.pathname)) return;
  const a = document.createElement('a');
  a.className = 'ac-wa-float';
  a.href = acWhatsAppHref();
  a.target = '_blank'; a.rel = 'noopener noreferrer';
  a.setAttribute('data-i18n-aria', 'contact_wa_aria'); a.setAttribute('aria-label', 'WhatsApp');
  a.setAttribute('data-track', 'contact_click'); a.setAttribute('data-channel', 'whatsapp_float');
  a.innerHTML = AC_SOCIAL_ICONS.whatsapp;
  document.body.appendChild(a);
  document.body.classList.add('has-wa-float');
}

// Signed in (e.g. straight from the email-confirmation link) with Amaan's listing
// notes still waiting on this device: offer a way back to the filled-in form.
function acRenderAmaanResume(user) {
  if (!user || user.role === 'admin' || typeof acAmaanDraftWaiting !== 'function' || !acAmaanDraftWaiting()) return;
  if (/(^|\/)(sell|login|signup)\.html$/.test(location.pathname)) return;
  const bar = document.createElement('div');
  bar.className = 'ac-amaan-resume'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<div class="container"><span data-i18n="amaan_waiting"></span> ' +
    '<a href="' + AC_AMAAN_FORM + '" class="btn btn-primary btn-sm" data-i18n="amaan_continue"></a></div>';
  const nav = document.getElementById('nav');
  if (nav) bar.style.setProperty('--ac-nav-h', nav.getBoundingClientRect().height + 'px');
  document.body.appendChild(bar);
}

document.addEventListener('DOMContentLoaded', async function () {
  await acRenderHeader();
  acRenderAmaanResume(typeof AcDB !== 'undefined' ? await AcDB.currentUser() : null);
  acRenderFooter();
  acRenderWhatsAppFloat();
  if (typeof acInitLanguage === 'function') acInitLanguage();
});
