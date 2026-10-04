// AgenticCore Estate — property detail page (Marketplace V2)
// Sample listings: SAMPLE notice, no trust badges, no contact, no owner tools.
// Genuine listings: attribution (agency / professional / project), the shared
// contact + enquiry box, and owner tools including the AgenticCore Pakistan handoff.


const detailRoot = document.getElementById('listingDetailRoot');
if (detailRoot) {
  (async function () {
    const id = new URLSearchParams(window.location.search).get('id');
    const listing = id && /^[0-9a-f-]{36}$/i.test(id) ? await AcDB.getListing(id) : null;

    if (!listing) {
      detailRoot.innerHTML = '<div class="mk-empty">' + acEsc(acT('mk_not_found')) + ' <a href="properties.html">' + acEsc(acT('mk_dir_properties_h')) + ' →</a></div>';
      return;
    }
    const owner = listing.is_sample ? null : await AcDB.getUser(listing.owner_id);
    const settings = await AcMarket.settings();
    const canonical = acCanonicalUrl('listing.html', listing.id);
    acSetPageMeta({ title: listing.title, url: canonical, description: listing.description, noindex: listing.is_sample,
      image: acMediaUrl((listing.photos || [])[0] || '') });

    function attributionHTML() {
      const rows = [];
      if (listing.agency) rows.push('<a class="mk-attr" href="agency.html?id=' + encodeURIComponent(listing.agency.id) + '">' +
        (acMediaUrl(listing.agency.logo_url) ? '<img src="' + acMediaUrl(listing.agency.logo_url) + '" alt="" width="40" height="40">' : '') +
        '<span><small>' + acEsc(acT('mk_cat_agencies')) + '</small>' + acEsc(listing.agency.name) + '</span></a>');
      if (listing.professional) rows.push('<a class="mk-attr" href="professional.html?id=' + encodeURIComponent(listing.professional.id) + '">' +
        acAvatarHTML(listing.professional.avatar_url, listing.professional.display_name, 40) +
        '<span><small>' + acEsc(acT('mk_cat_professionals')) + '</small>' + acEsc(listing.professional.display_name) + '</span></a>');
      if (listing.project) rows.push('<a class="mk-attr" href="project.html?id=' + encodeURIComponent(listing.project.id) + '"><span><small>' +
        acEsc(acT('mk_cat_projects')) + '</small>' + acEsc(listing.project.title) + '</span></a>');
      if (!rows.length && !listing.is_sample) rows.push('<p class="mk-attr-plain">' + acEsc(owner ? owner.full_name : '') + ' · ' + acEsc(acT('mk_individual')) + '</p>');
      return rows.length ? '<div class="panel mk-listed-by"><h3>' + acEsc(acT('mk_listed_by')) + '</h3>' + rows.join('') + '</div>' : '';
    }

    // Every badge shown with what it means — and what it does not mean. Never on samples.
    function trustHTML() {
      if (listing.is_sample) return '';
      const badges = acTrustBadges(listing, owner);
      if (!badges.length) return '';
      return '<div class="panel"><h3>' + acEsc(acT('trust_h')) + '</h3><ul class="trust-list">' +
        badges.map(function (b) { return '<li><span class="listing-badge ' + b.key + '">' + acEsc(b.label) + '</span><p>' + acEsc(b.tip) + '</p></li>'; }).join('') +
        '</ul><p class="mk-fine">' + acEsc(acT('trust_disclaimer')) + '</p></div>';
    }

    function render() {
      const photos = listing.photos || [];
      const hero = acMediaUrl(photos[0]);
      const gallery = photos.slice(1).map(function (url) {
        return acMediaUrl(url) ? '<a href="' + acMediaUrl(url) + '" target="_blank" rel="noopener"><img src="' + acMediaUrl(url) + '" alt="" loading="lazy"></a>' : '';
      }).join('');
      const unit = acSizeUnitLabel(listing.sizeUnit || 'marla');
      // Lahore, Karachi, Sialkot, Faisalabad before 6 Oct: only the owner can open it yet
      const prelaunch = !listing.is_sample && typeof acCityLaunching === 'function' && acCityLaunching(listing.city);
      detailRoot.innerHTML =
        (listing.is_sample ? acSampleNoticeHTML() : '') +
        (prelaunch ? '<p class="ac-city-note" role="status">' + acEsc(acT('city_saved_prelaunch').replace('{city}', listing.city).replace(/^[^✓]*✓\s*/, '')) + '</p>' : '') +
        '<div class="mk-hero mk-hero-listing">' + (hero ? '<img src="' + hero + '" alt="' + acEsc(listing.title) + '" decoding="async">' : '<span class="mk-media-icon">' + AC_ICONS.house + '</span>') +
          '<span class="mk-purpose ' + (listing.type === 'rent' ? 'rent' : 'buy') + '">' + acEsc(acPurposeLabel(listing.type)) + '</span>' +
          (listing.is_sample ? acSampleBadge('listing') : acPromoBadge(listing, settings)) + '</div>' +
        (gallery ? '<div class="mk-gallery" style="margin-bottom:1rem">' + gallery + '</div>' : '') +
        (listing.is_sample ? '' : acShareBarHTML('property')) +
        '<div class="mk-detail-grid"><div class="mk-detail-main">' +
          '<h1 class="mk-listing-title">' + acEsc(listing.title) + '</h1>' +
          '<p class="mk-sub">' + acEsc(acPropertyTypeLabel(listing.property_type)) + ' · ' + acEsc(listing.area) + ', ' + acEsc(listing.city) + '</p>' +
          '<div class="mk-price mk-price-big">' + acFormatPKR(listing.price) + (listing.type === 'rent' ? '<span class="period">' + acEsc(acT('listing_month')) + '</span>' : '') +
            (listing.is_sample ? ' <span class="mk-self">(' + acEsc(acT('mk_illustrative')) + ')</span>' : '') + '</div>' +
          '<dl class="mk-facts">' +
            (listing.beds ? '<div class="mk-fact"><dt>' + acEsc(acT('mk_beds')) + '</dt><dd>' + listing.beds + '</dd></div>' : '') +
            (listing.baths ? '<div class="mk-fact"><dt>' + acEsc(acT('mk_baths')) + '</dt><dd>' + listing.baths + '</dd></div>' : '') +
            '<div class="mk-fact"><dt>' + acEsc(acT('mk_f_size')) + '</dt><dd>' + acEsc(listing.sizeMarla) + ' ' + acEsc(unit) + '</dd></div>' +
          '</dl>' +
          '<section class="mk-section"><h2>' + acEsc(acT('mk_description')) + '</h2><p class="mk-pre">' + acEsc(listing.description) + '</p></section>' +
          '<div id="detailAiSlot"></div>' +
        '</div><aside>' + attributionHTML() + acContactBoxHTML('listing', listing) + trustHTML() + '</aside></div>' +
        '<p class="mk-back"><a href="properties.html">← ' + acEsc(acT('mk_dir_properties_h')) + '</a></p>';
      acWireContactBox('listing', listing, 'listing.html?id=' + listing.id);
      if (!listing.is_sample) acWireShareBar(detailRoot, listing.title, canonical, 'share_property');
      renderOwnerTools();
    }

    // Owner-only: deterministic listing quality with fix-it tips.
    let isOwner = false;
    function renderOwnerTools() {
      const slot = document.getElementById('detailAiSlot');
      if (!slot) return;
      if (!isOwner || listing.is_sample) { slot.innerHTML = ''; return; }
      slot.innerHTML = acListingQualityWidget(listing, {
        id: 'quality',
        actions: '<div class="lq-actions"><a class="btn btn-primary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_edit')) + '</a>' +
          '<a class="btn btn-secondary btn-sm" href="toolkit.html?id=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_toolkit')) + '</a></div>'
      });
    }

    const params = new URLSearchParams(window.location.search);
    const flash = params.get('prelaunch') ? acT('city_saved_prelaunch').replace('{city}', listing.city) : params.get('posted') ? acT('mk_flash_posted') : params.get('saved') ? acT('mk_flash_saved') : '';

    window.acOnLanguageChange = render;
    render();
    const viewer = await AcDB.currentUser();
    if (viewer && !listing.is_sample && (viewer.id === listing.owner_id || viewer.role === 'admin')) {
      isOwner = viewer.id === listing.owner_id;
      renderOwnerTools();
      if (window.location.hash === '#quality') { const q = document.getElementById('quality'); if (q) q.scrollIntoView({ block: 'start' }); }
      // The PK handoff carries only the listing id; AgenticCore Pakistan checks
      // ownership again after login (pk_0003) — the link itself proves nothing.
      detailRoot.insertAdjacentHTML('beforebegin',
        '<div class="panel mk-owner-bar">' +
          '<span>' + (flash ? '<strong>' + acEsc(flash) + '</strong> ' : '') + acEsc(acT(isOwner ? 'mk_your_listing' : 'mk_admin_view')) + '</span>' +
          '<span class="mk-owner-actions"><a class="btn btn-secondary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('mk_edit_listing')) + '</a> ' +
          '<a class="btn btn-secondary btn-sm" href="my.html#properties">' + acEsc(acT('mk_my_listings')) + '</a>' +
          (isOwner ? ' <a class="btn btn-secondary btn-sm" href="toolkit.html?id=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_toolkit')) + '</a>' +
            ' <a class="btn btn-primary btn-sm" href="' + acPkUrl('promote', 'property', listing.id, '') + '" rel="noopener" data-track="promote_property_click" data-intent="promote" data-entity="property">' + acEsc(acT('mk_promote_pk')) + '</a>' : '') +
          '</span>' +
          // No public number anywhere on this listing: tell the owner where to add one (the login phone is never shown).
          (isOwner && !viewer.public_phone && !listing.agency && !listing.professional
            ? '<p class="mk-fine">' + acEsc(acT('own_no_public_phone')) + ' <a href="my.html#account">' + acEsc(acT('own_add_phone')) + '</a></p>' : '') +
          '</div>' + (isOwner ? acPkPathwaysHTML('property', listing.id, 'promote') : ''));
    }
  })();
}
