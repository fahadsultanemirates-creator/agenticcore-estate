// AgenticCore Estate — buyer/seller dashboard

const dashRoot = document.getElementById('dashRoot');
if (dashRoot) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller', 'admin']);
    if (!user) return;

    document.getElementById('dashName').textContent = user.full_name;
    document.getElementById('dashName').title = user.email || '';
    document.getElementById('dashPoints').textContent = user.points;
    document.getElementById('dashReferralCode').textContent = user.referral_code;

    const tbody = document.getElementById('dashListingsBody');
    if (tbody) acWireMyListings(tbody, user.id, function (list) {
      document.getElementById('dashListingCount').textContent = list.length;
    });

    const referrals = await AcDB.getDirectReferrals();
    document.getElementById('dashReferralCount').textContent = referrals.length;

    const dashPackageGrid = document.getElementById('dashPackageGrid');
    if (dashPackageGrid) dashPackageGrid.innerHTML = acPackageGridHTML(AC_SELLER_PACKAGES, user.seller_package, 'pricing.html');

    if (typeof acMountReferralCta === 'function') acMountReferralCta(user);
  })();
}
