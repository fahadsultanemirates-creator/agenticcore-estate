// AgenticCore Estate — buyer/seller dashboard

const dashRoot = document.getElementById('dashRoot');
if (dashRoot) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller']);
    if (!user) return;

    document.getElementById('dashName').textContent = user.full_name;
    document.getElementById('dashPoints').textContent = user.points;
    document.getElementById('dashReferralCode').textContent = user.referral_code;

    const myListings = await AcDB.getListingsByOwner(user.id);
    document.getElementById('dashListingCount').textContent = myListings.length;

    const tbody = document.getElementById('dashListingsBody');
    if (tbody) {
      tbody.innerHTML = myListings.map(function (l) {
        return '<tr><td>' + l.title + '</td><td>' + l.type + '</td><td>' + acFormatPKR(l.price) + '</td>' +
          '<td>' + (l.verified ? '<span class="badge badge-emerald">Verified</span>' : '<span class="badge badge-muted">Unverified</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" style="color:var(--text-tertiary);">You haven\'t listed a property yet.</td></tr>';
    }

    const tree = await AcDB.getReferralTree(user.id);
    document.getElementById('dashReferralCount').textContent = tree.reduce(function (sum, l) { return sum + l.length; }, 0);
  })();
}
