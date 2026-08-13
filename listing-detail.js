// AgenticCore Estate — individual listing detail page

const detailRoot = document.getElementById('listingDetailRoot');
if (detailRoot) {
  const id = new URLSearchParams(window.location.search).get('id');
  const listing = id ? AcDB.getListing(id) : null;

  if (!listing) {
    detailRoot.innerHTML = '<div class="empty-state">This listing could not be found. <a href="buy.html" style="color:var(--accent-gold-bright);">Browse listings →</a></div>';
  } else {
    const owner = AcDB.getUser(listing.ownerId);
    document.title = listing.title + ' — AgenticCore Estate';

    function render() {
      const lang = localStorage.getItem('acLang') === 'ur' ? 'ur' : 'en';
      const dict = AC_I18N[lang];
      const priceSuffix = listing.type === 'rent' ? '<span class="period">' + dict.listing_month + '</span>' : '';

      detailRoot.innerHTML =
        '<div class="listing-thumb" style="aspect-ratio:16/7;border-radius:var(--radius-lg);margin-bottom:var(--space-lg);">' +
          '<span class="listing-badge ' + listing.type + '">' + (listing.type === 'buy' ? dict.search_buy : dict.search_rent) + '</span>' +
          (listing.verified ? '<span class="listing-badge verified">✓ Verified</span>' : '') +
          AC_HOUSE_ICON +
        '</div>' +
        '<div class="form-grid" style="align-items:start;">' +
          '<div>' +
            '<h1 style="font-size:1.8rem;margin-bottom:0.4rem;">' + listing.title + '</h1>' +
            '<p style="color:var(--text-secondary);margin-bottom:1rem;">' + listing.area + ', ' + listing.city + '</p>' +
            '<div class="listing-price" style="font-size:1.6rem;margin-bottom:1rem;">' + acFormatPKR(listing.price) + priceSuffix + '</div>' +
            '<div class="listing-specs" style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:1rem;margin-bottom:1.5rem;">' +
              (listing.beds ? '<span>' + listing.beds + ' ' + dict.listing_beds + '</span>' : '') +
              (listing.baths ? '<span>' + listing.baths + ' ' + dict.listing_baths + '</span>' : '') +
              '<span>' + listing.sizeMarla + ' ' + dict.listing_marla + '</span>' +
            '</div>' +
            '<h3 style="font-size:1.1rem;margin-bottom:0.5rem;">Description</h3>' +
            '<p style="color:var(--text-secondary);">' + listing.description + '</p>' +
          '</div>' +
          '<div>' +
            '<div class="panel">' +
              '<h3>Listed by</h3>' +
              '<p style="color:var(--text-primary);font-weight:600;">' + (owner ? owner.fullName : 'AgenticCore Estate user') + '</p>' +
              '<p style="color:var(--text-secondary);font-size:0.85rem;margin-bottom:0.8rem;">' + (owner && owner.role === 'developer' ? 'Verified developer account' : 'Individual seller') + '</p>' +
              '<a href="login.html" class="btn btn-primary btn-block">Contact about this property</a>' +
            '</div>' +
            '<div id="detailAiSlot"></div>' +
          '</div>' +
        '</div>';

      document.getElementById('detailAiSlot').innerHTML = acGrowthScoreWidget(null) + acDocCheckWidget(listing.verified ? 'pending model integration' : 'not_run');
    }

    window.acOnLanguageChange = render;
    render();
  }
}
