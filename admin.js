// AgenticCore Estate — Admin panel: developer document review

const adminLoginForm = document.getElementById('adminLoginForm');
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;
    const result = await AcDB.logIn(identifier, password);
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
  (async function () {
    const admin = await requireAuth(['admin']);
    if (!admin) return;

    async function docLinkHTML(path, label) {
      const url = await AcDB.getSignedDocUrl(path);
      return url ? '<a href="' + url + '" target="_blank" rel="noopener">' + label + '</a>' : label + ' (unavailable)';
    }

    async function renderQueue() {
      const pending = await AcDB.listApplications('pending');
      const tbody = document.getElementById('adminPendingBody');
      document.getElementById('adminPendingCount').textContent = pending.length;

      const rows = await Promise.all(pending.map(async function (app) {
        const dueMs = new Date(app.due_by).getTime() - Date.now();
        const dueLabel = dueMs > 0 ? Math.round(dueMs / 3600000) + 'h left' : 'overdue';
        const cnicLink = await docLinkHTML(app.cnic_document_path, 'CNIC');
        const companyLink = await docLinkHTML(app.company_document_path, 'Company doc');
        return (
          '<tr>' +
            '<td>' + app.company_name + '<div style="font-size:0.75rem;color:var(--text-tertiary);">Tier ' + app.tier + '</div></td>' +
            '<td>' + app.phone + '</td>' +
            '<td>' + app.cnic + '</td>' +
            '<td>' + cnicLink + '<br>' + companyLink + '</td>' +
            '<td>' + new Date(app.submitted_at).toLocaleDateString() + '</td>' +
            '<td><span class="badge badge-pending">' + dueLabel + '</span></td>' +
            '<td class="table-actions">' +
              '<button class="btn btn-primary btn-sm" data-approve="' + app.id + '">Approve</button>' +
              '<button class="btn btn-danger btn-sm" data-reject="' + app.id + '">Reject</button>' +
            '</td>' +
          '</tr>'
        );
      }));

      tbody.innerHTML = rows.join('') || '<tr><td colspan="7" style="color:var(--text-tertiary);">No applications waiting for review.</td></tr>';

      tbody.querySelectorAll('[data-approve]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          btn.disabled = true;
          await AcDB.decideApplication(btn.getAttribute('data-approve'), 'approved', admin.id, 'Documents verified.');
          renderQueue(); renderHistory();
        });
      });
      tbody.querySelectorAll('[data-reject]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const note = prompt('Reason for rejection (shown to the applicant):', 'CNIC image unreadable — please re-upload.');
          if (note === null) return;
          btn.disabled = true;
          await AcDB.decideApplication(btn.getAttribute('data-reject'), 'rejected', admin.id, note);
          renderQueue(); renderHistory();
        });
      });
    }

    async function renderHistory() {
      const all = await AcDB.listApplications();
      const decided = all.filter(function (a) { return a.status !== 'pending'; });
      const tbody = document.getElementById('adminHistoryBody');
      tbody.innerHTML = decided.map(function (app) {
        const cls = app.status === 'approved' ? 'badge-emerald' : 'badge-pending';
        return '<tr><td>' + app.company_name + '</td><td>Tier ' + app.tier + '</td>' +
          '<td><span class="badge ' + cls + '">' + app.status + '</span></td>' +
          '<td>' + (app.decision_at ? new Date(app.decision_at).toLocaleDateString() : '—') + '</td>' +
          '<td>' + (app.reviewer_note || '—') + '</td></tr>';
      }).join('') || '<tr><td colspan="5" style="color:var(--text-tertiary);">No decisions yet.</td></tr>';
    }

    const [users, listings] = await Promise.all([AcDB.listUsers(), AcDB.getListings()]);
    document.getElementById('adminUserCount').textContent = users.length;
    document.getElementById('adminListingCount').textContent = listings.length;
    document.getElementById('adminDevCount').textContent = users.filter(function (u) { return u.role === 'developer' && u.developer_status === 'approved'; }).length;

    renderQueue();
    renderHistory();
  })();
}
