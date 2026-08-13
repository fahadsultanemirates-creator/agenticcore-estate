// AgenticCore Estate — Admin panel: developer document review

const adminLoginForm = document.getElementById('adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const result = AcDB.logIn(identifier, password);
    if (result.error || result.user.role !== 'admin') {
      errorEl.textContent = 'Incorrect admin credentials.';
      errorEl.style.display = 'block';
      return;
    }
    window.location.href = 'admin-dashboard.html';
  });
}

const adminRoot = document.getElementById('adminRoot');
if (adminRoot) {
  requireAuth(['admin']);

  function renderQueue() {
    const pending = AcDB.listApplications('pending');
    const tbody = document.getElementById('adminPendingBody');
    document.getElementById('adminPendingCount').textContent = pending.length;

    tbody.innerHTML = pending.map(function (app) {
      const dueMs = new Date(app.dueBy).getTime() - Date.now();
      const dueLabel = dueMs > 0 ? Math.round(dueMs / 3600000) + 'h left' : 'overdue';
      return (
        '<tr>' +
          '<td>' + app.companyName + '<div style="font-size:0.75rem;color:var(--text-tertiary);">Tier ' + app.tier + '</div></td>' +
          '<td>' + app.phone + '</td>' +
          '<td>' + app.cnic + '</td>' +
          '<td>' + app.cnicFileName + '<br>' + app.companyDocFileName + '</td>' +
          '<td>' + new Date(app.submittedAt).toLocaleDateString() + '</td>' +
          '<td><span class="badge badge-pending">' + dueLabel + '</span></td>' +
          '<td class="table-actions">' +
            '<button class="btn btn-primary btn-sm" data-approve="' + app.id + '">Approve</button>' +
            '<button class="btn btn-danger btn-sm" data-reject="' + app.id + '">Reject</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('') || '<tr><td colspan="7" style="color:var(--text-tertiary);">No applications waiting for review.</td></tr>';

    tbody.querySelectorAll('[data-approve]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        AcDB.decideApplication(btn.getAttribute('data-approve'), 'approved', AcDB.currentUser().id, 'Documents verified.');
        renderQueue(); renderHistory();
      });
    });
    tbody.querySelectorAll('[data-reject]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const note = prompt('Reason for rejection (shown to the applicant):', 'CNIC image unreadable — please re-upload.');
        if (note === null) return;
        AcDB.decideApplication(btn.getAttribute('data-reject'), 'rejected', AcDB.currentUser().id, note);
        renderQueue(); renderHistory();
      });
    });
  }

  function renderHistory() {
    const decided = AcDB.listApplications().filter(function (a) { return a.status !== 'pending'; });
    const tbody = document.getElementById('adminHistoryBody');
    tbody.innerHTML = decided.map(function (app) {
      const cls = app.status === 'approved' ? 'badge-emerald' : 'badge-pending';
      return '<tr><td>' + app.companyName + '</td><td>Tier ' + app.tier + '</td>' +
        '<td><span class="badge ' + cls + '">' + app.status + '</span></td>' +
        '<td>' + (app.decisionAt ? new Date(app.decisionAt).toLocaleDateString() : '—') + '</td>' +
        '<td>' + (app.reviewerNote || '—') + '</td></tr>';
    }).join('') || '<tr><td colspan="5" style="color:var(--text-tertiary);">No decisions yet.</td></tr>';
  }

  document.getElementById('adminUserCount').textContent = AcDB.listUsers().length;
  document.getElementById('adminListingCount').textContent = AcDB.getListings().length;
  document.getElementById('adminDevCount').textContent = AcDB.listUsers().filter(function (u) { return u.role === 'developer' && u.developerStatus === 'approved'; }).length;

  renderQueue();
  renderHistory();
}
