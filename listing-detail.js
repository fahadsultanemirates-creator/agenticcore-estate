// AgenticCore Estate — individual listing detail page

const detailRoot = document.getElementById('listingDetailRoot');
if (detailRoot) {
  (async function () {
    const id = new URLSearchParams(window.location.search).get('id');
    const listing = id ? await AcDB.getListing(id) : null;

    if (!listing) {
      detailRoot.innerHTML = '<div class="empty-state">This listing could not be found. <a href="buy.html" style="color:var(--accent-gold-bright);">Browse listings →</a></div>';
      return;
    }

    const owner = await AcDB.getUser(listing.owner_id);
    document.title = listing.title + ' — AgenticCore Estate';
    const featured = owner && owner.developer_tier === 3;

    function render() {
      const lang = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
      const dict = AC_I18N[lang];
      const priceSuffix = listing.type === 'rent' ? '<span class="period">' + dict.listing_month + '</span>' : '';
      const thumb = listing.photos && listing.photos.length
        ? '<img src="' + acSafeUrl(listing.photos[0]) + '" alt="' + acEsc(listing.title) + '" style="width:100%;height:100%;object-fit:cover;">'
        : AC_HOUSE_ICON;
      const gallery = (listing.photos || []).slice(1).map(function (url) {
        return '<a href="' + acSafeUrl(url) + '" target="_blank" rel="noopener"><img src="' + acSafeUrl(url) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:var(--radius-md);"></a>';
      }).join('');

      detailRoot.innerHTML =
        '<div class="listing-thumb" style="aspect-ratio:16/7;border-radius:var(--radius-lg);margin-bottom:var(--space-lg);">' +
          '<span class="listing-badge ' + listing.type + '">' + (listing.type === 'buy' ? dict.search_buy : dict.search_rent) + '</span>' +
          (listing.verified ? '<span class="listing-badge verified" title="' + acEsc(acT('badge_checked_tip')) + '">' + acEsc(acT('badge_checked')) + '</span>' : '') +
          (featured ? '<span class="listing-badge featured">★ Featured Agency</span>' : '') +
          thumb +
        '</div>' +
        (gallery ? '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.6rem;margin-bottom:var(--space-lg);">' + gallery + '</div>' : '') +
        '<div class="form-grid" style="align-items:start;">' +
          '<div>' +
            '<h1 style="font-size:1.8rem;margin-bottom:0.4rem;">' + acEsc(listing.title) + '</h1>' +
            '<p style="color:var(--text-secondary);margin-bottom:1rem;">' + acEsc(acPropertyTypeLabel(listing.property_type)) + ' · ' + acEsc(listing.area) + ', ' + acEsc(listing.city) + '</p>' +
            '<div class="listing-price" style="font-size:1.6rem;margin-bottom:1rem;">' + acFormatPKR(listing.price) + priceSuffix + '</div>' +
            '<div class="listing-specs" style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;margin-bottom:1.5rem;">' +
              (listing.beds ? '<span>' + listing.beds + ' ' + dict.listing_beds + '</span>' : '') +
              (listing.baths ? '<span>' + listing.baths + ' ' + dict.listing_baths + '</span>' : '') +
              '<span>' + acEsc(listing.sizeMarla) + ' ' + acSizeUnitLabel(listing.sizeUnit || 'marla') + '</span>' +
            '</div>' +
            '<h3 style="font-size:1.1rem;margin-bottom:0.5rem;">Description</h3>' +
            '<p style="color:var(--text-secondary);white-space:pre-line;">' + acEsc(listing.description) + '</p>' +
          '</div>' +
          '<div>' +
            '<div class="panel">' +
              '<h3>Listed by</h3>' +
              (owner && owner.role === 'agency' && owner.agency_logo_path ?
                '<img src="' + acSafeUrl(owner.agency_logo_path) + '" alt="" style="width:48px;height:48px;border-radius:10px;object-fit:cover;margin-bottom:0.5rem;">' : '') +
              '<p style="color:var(--text-primary);font-weight:600;">' +
                acEsc(owner && owner.role === 'agency' ? (owner.agency_name || owner.full_name) : (owner ? owner.full_name : 'AgenticCore Estate user')) +
              '</p>' +
              '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.8rem;">' +
                (owner && owner.role === 'developer' ? (featured ? 'Elite developer' : 'Developer account') :
                 owner && owner.role === 'agency' ? 'Agency listing' : 'Individual seller') +
              '</p>' +
              trustHTML() +
              '<div id="contactSlot"><button type="button" class="btn btn-primary btn-block" id="contactBtn">Contact about this property</button></div>' +
            '</div>' +
            '<div id="detailAiSlot"></div>' +
          '</div>' +
        '</div>';

      wireContact();
      renderOwnerTools();
    }

    // Every badge shown with what it means — and what it does not mean.
    function trustHTML() {
      const badges = acTrustBadges(listing, owner);
      if (!badges.length) return '';
      return '<h4 style="font-size:0.9rem;margin:0.4rem 0 0.2rem;">' + acEsc(acT('trust_h')) + '</h4><ul class="trust-list">' +
        badges.map(function (b) { return '<li><span class="listing-badge ' + b.key + '">' + acEsc(b.label) + '</span><p>' + acEsc(b.tip) + '</p></li>'; }).join('') +
        '</ul><p style="font-size:0.75rem;color:var(--text-tertiary);margin-bottom:0.8rem;">' + acEsc(acT('trust_disclaimer')) + '</p>';
    }

    // Owner-only: deterministic listing quality with fix-it tips.
    let isOwner = false;
    function renderOwnerTools() {
      const slot = document.getElementById('detailAiSlot');
      if (!slot) return;
      if (!isOwner) { slot.innerHTML = ''; return; }
      slot.innerHTML = acListingQualityWidget(listing, {
        id: 'quality',
        actions: '<div class="lq-actions"><a class="btn btn-primary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_edit')) + '</a>' +
          '<a class="btn btn-secondary btn-sm" href="toolkit.html?id=' + encodeURIComponent(listing.id) + '">' + acEsc(acT('lq_toolkit')) + '</a></div>'
      });
    }

    // Seller contact: signed-in visitors see the seller's number (via a
    // security-definer RPC, so phone numbers are never publicly readable);
    // everyone else logs in first and is brought straight back here.
    let viewer = null;
    let contact = null;
    function showContact(slot) {
      const digits = String(contact.phone).replace(/[^0-9]/g, '').replace(/^0/, '92');
      const msg = 'Assalam-o-Alaikum, I saw your listing "' + listing.title + '" on AgenticCore Estate: ' + window.location.href;
      slot.innerHTML =
        '<p style="font-size:1.1rem;font-weight:600;margin-bottom:0.6rem;">' + acEsc(contact.phone) + '</p>' +
        '<a class="btn btn-primary btn-block" href="tel:+' + digits + '" style="margin-bottom:0.5rem;">Call</a>' +
        '<a class="btn btn-secondary btn-block" target="_blank" rel="noopener" href="https://wa.me/' + digits + '?text=' + encodeURIComponent(msg) + '">WhatsApp</a>';
    }
    function wireContact() {
      const btn = document.getElementById('contactBtn');
      const slot = document.getElementById('contactSlot');
      if (!btn || !slot) return;
      if (contact) { showContact(slot); return; }
      btn.addEventListener('click', async function () {
        viewer = viewer || await AcDB.currentUser();
        if (!viewer) { window.location.href = 'login.html?next=' + encodeURIComponent('listing.html?id=' + listing.id); return; }
        btn.disabled = true; btn.textContent = 'Loading…';
        const res = await AcDB.getListingContact(listing.id);
        if (res.error || !res.contact || !res.contact.phone) {
          btn.disabled = false; btn.textContent = 'Contact about this property';
          slot.insertAdjacentHTML('beforeend', '<p style="color:var(--text-tertiary);font-size:0.85rem;margin-top:0.5rem;">Contact details are not available right now. Please try again later.</p>');
          return;
        }
        contact = res.contact;
        showContact(slot);
      });
    }

    const params = new URLSearchParams(window.location.search);
    const flash = params.get('posted') ? 'Your listing is live.' : params.get('saved') ? 'Your changes are saved.' : '';

    window.acOnLanguageChange = render;
    render();
    viewer = await AcDB.currentUser();
    if (viewer && (viewer.id === listing.owner_id || viewer.role === 'admin')) {
      isOwner = true;
      renderOwnerTools();
      if (window.location.hash === '#quality') { const q = document.getElementById('quality'); if (q) q.scrollIntoView({ block: 'start' }); }
      detailRoot.insertAdjacentHTML('beforebegin',
        '<div class="panel" style="display:flex;flex-wrap:wrap;gap:0.6rem;align-items:center;justify-content:space-between;margin-bottom:var(--space-md);">' +
          '<span style="color:var(--text-secondary);">' + (flash ? '<strong style="color:var(--accent-gold-bright);">' + flash + '</strong> ' : '') + 'This is your listing.</span>' +
          '<span><a class="btn btn-secondary btn-sm" href="sell.html?edit=' + encodeURIComponent(listing.id) + '">Edit listing</a> ' +
          '<a class="btn btn-secondary btn-sm" href="' + (viewer.role === 'agency' ? 'agency-dashboard.html' : 'dashboard.html') + '">My listings</a></span></div>');
    }
  })();
}
