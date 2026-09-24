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
  (async function () {
    const user = await requireAuth(['developer']);
    if (!user) return;
    if (user.developer_status === 'pending') { window.location.href = 'developer-pending.html'; return; }
    if (user.developer_status === 'approved') { window.location.href = 'developer-dashboard.html'; return; }

    acWireFileDrop('cnicFile', 'cnicDrop');
    acWireFileDrop('companyDocFile', 'companyDocDrop');

    devApplyForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const cnicFile = document.getElementById('cnicFile').files[0];
      const companyDocFile = document.getElementById('companyDocFile').files[0];
      const errorEl = document.getElementById('authError');
      const submitBtn = devApplyForm.querySelector('button[type="submit"]');

      if (!cnicFile || !companyDocFile) {
        errorEl.textContent = 'Please upload both your CNIC and a company/registration document to continue.';
        errorEl.style.display = 'block';
        return;
      }

      const tier = document.querySelector('input[name="tier"]:checked').value;
      const companyName = document.getElementById('companyName').value.trim();
      const phone = document.getElementById('devPhone').value.trim();
      const cnic = document.getElementById('devCnic').value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = 'Uploading documents…';

      const result = await AcDB.submitDeveloperApplication({
        userId: user.id, companyName, phone, cnic, cnicFile, companyDocFile, tier: Number(tier)
      });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit for verification';
        return;
      }

      window.location.href = 'developer-pending.html';
    });
  })();
}

// -------- pending page --------
const pendingRoot = document.getElementById('pendingRoot');
if (pendingRoot) {
  (async function () {
    const user = await requireAuth(['developer']);
    if (!user) return;
    if (user.developer_status === 'approved') { window.location.href = 'developer-dashboard.html'; return; }

    const app = await AcDB.getApplicationForUser(user.id);
    if (!app) { window.location.href = 'developer-apply.html'; return; }

    document.getElementById('pendingCompany').textContent = app.company_name;
    document.getElementById('pendingSubmitted').textContent = new Date(app.submitted_at).toLocaleString();
    document.getElementById('pendingTier').textContent = 'Tier ' + app.tier;

    function tick() {
      const due = new Date(app.due_by).getTime();
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
      document.getElementById('pendingRejectedNote').textContent = app.reviewer_note || 'No reason provided.';
    }
  })();
}

// -------- developer dashboard --------
const devDashRoot = document.getElementById('devDashRoot');
if (devDashRoot) {
  (async function () {
    const user = await requireAuth(['developer']);
    if (!user) return;
    if (user.developer_status === 'pending' || user.developer_status === 'unsubmitted') {
      window.location.href = user.developer_status === 'pending' ? 'developer-pending.html' : 'developer-apply.html';
      return;
    }

    document.getElementById('devName').textContent = user.full_name;
    const tierNames = { 1: 'Starter', 2: 'Growth', 3: 'Elite' };
    const tierPrices = { 1: 'Rs 2,000/mo', 2: 'Rs 10,000/mo', 3: 'Rs 20,000/mo' };
    const tierCaps = { 1: 5, 2: 25, 3: null }; // null = unlimited
    document.getElementById('devTierBadge').textContent = tierNames[user.developer_tier] + ' package';
    document.getElementById('devTierPrice').textContent = tierPrices[user.developer_tier];

    const myListings = await AcDB.getListingsByOwner(user.id);
    const verifiedCount = myListings.filter(function (l) { return l.verified; }).length;
    const cap = tierCaps[user.developer_tier];
    document.getElementById('devListingCount').textContent = myListings.length;
    document.getElementById('devListingCap').textContent = cap === null ? 'unlimited' : cap;
    document.getElementById('devVerifiedNote').textContent = verifiedCount ? (' — ' + verifiedCount + ' verified') : '';
    const barPct = cap === null ? Math.min(100, myListings.length * 4) : Math.min(100, Math.round((myListings.length / cap) * 100));
    document.getElementById('devQuotaBar').style.width = barPct + '%';

    const tbody = document.getElementById('devListingsBody');
    if (tbody) {
      tbody.innerHTML = myListings.map(function (l) {
        return '<tr><td>' + l.title + '</td><td>' + l.city + '</td><td>' + acFormatPKR(l.price) + '</td>' +
          '<td>' + (l.verified ? '<span class="badge badge-emerald">Verified</span>' : '<span class="badge badge-muted">Unverified</span>') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" style="color:var(--text-tertiary);">No listings yet — post your first one from the Sell page.</td></tr>';
    }

    document.getElementById('devAiSlot').innerHTML = acGrowthScoreWidget(null) + acDocCheckWidget('not_run');
  })();
}
