// AgenticCore Estate — Developer Corner: application, pending state, dashboard

function acWireFileDrop(inputId, dropId) {
  const input = document.getElementById(inputId);
  const drop = document.getElementById(dropId);
  if (!input || !drop) return;
  const label = drop.querySelector('.file-drop-label');
  drop.addEventListener('click', function () { input.click(); });
  input.addEventListener('change', function () {
    if (input.files && input.files[0]) {
      drop.classList.add('has-file');
      if (label) label.textContent = '✓ ' + input.files[0].name;
    }
  });
}

const devApplyForm = document.getElementById('devApplyForm');
if (devApplyForm) {
  const user = requireAuth(['developer']);
  if (user) {
    if (user.developerStatus === 'pending') window.location.href = 'developer-pending.html';
    else if (user.developerStatus === 'approved') window.location.href = 'developer-dashboard.html';
  }
  acWireFileDrop('cnicFile', 'cnicDrop');
  acWireFileDrop('companyDocFile', 'companyDocDrop');

  devApplyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const cnicFile = document.getElementById('cnicFile').files[0];
    const companyDocFile = document.getElementById('companyDocFile').files[0];
    const errorEl = document.getElementById('authError');

    if (!cnicFile || !companyDocFile) {
      errorEl.textContent = 'Please upload both your CNIC and a company/registration document to continue.';
      errorEl.style.display = 'block';
      return;
    }

    const tier = document.querySelector('input[name="tier"]:checked').value;
    const companyName = document.getElementById('companyName').value.trim();
    const phone = document.getElementById('devPhone').value.trim();
    const cnic = document.getElementById('devCnic').value.trim();

    AcDB.submitDeveloperApplication({
      userId: user.id, companyName, phone, cnic,
      cnicFileName: cnicFile.name, companyDocFileName: companyDocFile.name,
      tier: Number(tier)
    });

    window.location.href = 'developer-pending.html';
  });
}

// -------- pending page --------
const pendingRoot = document.getElementById('pendingRoot');
if (pendingRoot) {
  const user = requireAuth(['developer']);
  if (user.developerStatus === 'approved') window.location.href = 'developer-dashboard.html';

  const app = user.developerApplicationId ? AcDB.getApplication(user.developerApplicationId) : null;
  if (!app) window.location.href = 'developer-apply.html';

  document.getElementById('pendingCompany').textContent = app.companyName;
  document.getElementById('pendingSubmitted').textContent = new Date(app.submittedAt).toLocaleString();
  document.getElementById('pendingTier').textContent = 'Tier ' + app.tier;

  function tick() {
    const due = new Date(app.dueBy).getTime();
    const diff = due - Date.now();
    const el = document.getElementById('pendingCountdown');
    if (!el) return;
    if (diff <= 0) { el.textContent = 'Review window elapsed — a reviewer will follow up shortly.'; return; }
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = h + 'h ' + m + 'm ' + s + 's';
  }
  tick();
  setInterval(tick, 1000);

  if (app.status === 'rejected') {
    document.getElementById('pendingRejected').style.display = 'block';
    document.getElementById('pendingRejectedNote').textContent = app.reviewerNote || 'No reason provided.';
  }
}

// -------- developer dashboard --------
const devDashRoot = document.getElementById('devDashRoot');
if (devDashRoot) {
  const user = requireAuth(['developer']);
  if (user.developerStatus === 'pending' || user.developerStatus === 'unsubmitted') {
    window.location.href = user.developerStatus === 'pending' ? 'developer-pending.html' : 'developer-apply.html';
  }

  document.getElementById('devName').textContent = user.fullName;
  const tierNames = { 1: 'Starter', 2: 'Growth', 3: 'Elite' };
  const tierPrices = { 1: 'Rs 2,000', 2: 'Rs 10,000', 3: 'Rs 20,000' };
  document.getElementById('devTierBadge').textContent = 'Tier ' + user.developerTier + ' — ' + tierNames[user.developerTier];
  document.getElementById('devTierPrice').textContent = tierPrices[user.developerTier] + '/month';

  const myListings = AcDB.getListingsByOwner(user.id);
  document.getElementById('devListingCount').textContent = myListings.length;
  document.getElementById('devVerifiedCount').textContent = myListings.filter(function (l) { return l.verified; }).length;
  document.getElementById('devPoints').textContent = user.points;

  const tbody = document.getElementById('devListingsBody');
  if (tbody) {
    tbody.innerHTML = myListings.map(function (l) {
      return '<tr><td>' + l.title + '</td><td>' + l.city + '</td><td>' + acFormatPKR(l.price) + '</td>' +
        '<td>' + (l.verified ? '<span class="badge badge-emerald">Verified</span>' : '<span class="badge badge-muted">Unverified</span>') + '</td></tr>';
    }).join('') || '<tr><td colspan="4" style="color:var(--text-tertiary);">No listings yet — post your first one from the Sell page.</td></tr>';
  }

  document.getElementById('devAiSlot').innerHTML = acGrowthScoreWidget(null) + acDocCheckWidget('not_run');
}
