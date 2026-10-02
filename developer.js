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

    devApplyForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('authError');
      const submitBtn = devApplyForm.querySelector('button[type="submit"]');

      const tier = document.querySelector('input[name="tier"]:checked').value;
      const companyName = document.getElementById('companyName').value.trim();
      const phone = document.getElementById('devPhone').value.trim();

      submitBtn.disabled = true;
      submitBtn.textContent = 'Setting up…';

      const result = await AcDB.submitDeveloperApplication({
        userId: user.id, companyName, phone, tier: Number(tier)
      });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create developer account';
        return;
      }

      // Applications are reviewed by an admin before the dashboard unlocks.
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
    if (user.developer_status !== 'approved') {
      // pending and rejected applications see their status (and any rejection note) on the pending page
      window.location.href = (user.developer_status === 'pending' || user.developer_status === 'rejected') ? 'developer-pending.html' : 'developer-apply.html';
      return;
    }

    document.getElementById('devName').textContent = user.full_name;
    document.getElementById('devTierBadge').textContent = AC_DEV_PACKAGE_NAMES[user.developer_tier] + ' package';
    document.getElementById('devTierPrice').textContent = AC_DEV_PACKAGE_PRICES[user.developer_tier];

    const myProjects = await AcDB.getProjectsByOwner(user.id);
    const cap = AC_DEV_PACKAGE_CAPS[user.developer_tier];
    document.getElementById('devListingCount').textContent = myProjects.length;
    document.getElementById('devListingCap').textContent = cap === null ? 'unlimited' : cap;
    document.getElementById('devVerifiedNote').textContent = '';
    const barPct = cap === null ? Math.min(100, myProjects.length * 4) : Math.min(100, Math.round((myProjects.length / cap) * 100));
    document.getElementById('devQuotaBar').style.width = barPct + '%';

    const devPackageGrid = document.getElementById('devPackageGrid');
    if (devPackageGrid) devPackageGrid.innerHTML = acPackageGridHTML(AC_DEV_PACKAGES, user.developer_tier, 'developer-packages.html');

    const tbody = document.getElementById('devListingsBody');
    if (tbody) {
      tbody.innerHTML = myProjects.map(function (p) {
        return '<tr><td>' + acEscHTML(p.title) + '</td><td>' + acEscHTML(p.city) + '</td><td>' + acEscHTML(acProjectUnitTypeLabel(p.unit_types)) + '</td>' +
          '<td>' + acEscHTML(acProjectStatusLabel(p.status)) + '</td></tr>';
      }).join('') || '<tr><td colspan="4" style="color:var(--text-tertiary);">No projects yet — post your first one.</td></tr>';
    }

    document.getElementById('devAiSlot').innerHTML = acGrowthScoreWidget(null) + acDocCheckWidget('not_run');

    if (typeof acMountReferralCta === 'function') acMountReferralCta(user);
  })();
}
