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
    // Any account can apply for the project-publisher capability (no second account, no role change).
    const user = await requireAuth();
    if (!user) return;
    const cap = await acCapabilityStatus();
    if (cap === 'pending') { window.location.href = 'developer-pending.html'; return; }
    if (cap === 'approved' || cap === 'revoked') { window.location.href = 'my.html#projects'; return; }

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
        submitBtn.textContent = acT('dev_apply_submit') || 'Submit application';
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
    const user = await requireAuth();
    if (!user) return;
    const cap = await acCapabilityStatus();
    if (cap === 'approved' || cap === 'revoked') { window.location.href = 'my.html#projects'; return; }

    const app = await AcDB.getApplicationForUser(user.id);
    if (!app) { window.location.href = 'developer-apply.html'; return; }

    document.getElementById('pendingCompany').textContent = app.company_name;
    document.getElementById('pendingSubmitted').textContent = new Date(app.submitted_at).toLocaleString();
    document.getElementById('pendingTier').textContent = acT('dev_scale_' + app.tier);

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
    const user = await requireAuth();
    if (!user) return;
    window.location.replace('my.html#projects');   // one dashboard for every account (Marketplace V2)
  })();
}
