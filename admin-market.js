/* ============================================
   AgenticCore Estate — admin: marketplace controls (Marketplace V2)
   Every write is a security-definer admin RPC that re-checks is_admin()
   and records an admin_log row; nothing here writes tables directly.
   ============================================ */

(function () {
  const root = document.getElementById('adminMarket');
  if (!root) return;
  const TABLE = { listing: 'listings', project: 'projects', professional: 'professionals', agency: 'agencies', company: 'companies' };
  const NAME = { listing: 'title', project: 'title', professional: 'display_name', agency: 'name', company: 'name' };
  const PUBLIC = { listing: 'listing.html', project: 'project.html', professional: 'professional.html', agency: 'agency.html', company: 'builder.html' };
  let cat = 'listing';
  const esc = acEscHTML;

  async function rpc(name, args) {
    const { error } = await supabaseClient.rpc(name, args);
    if (error) alert(error.message);
    return !error;
  }

  async function renderEntities() {
    const box = document.getElementById('admEntities');
    box.innerHTML = 'Loading…';
    const { data } = await supabaseClient.from(TABLE[cat]).select('id,owner_id,' + NAME[cat] + ',is_sample,verified,placement,moderation_status,created_at')
      .order('is_sample', { ascending: true }).order('created_at', { ascending: false }).limit(50);
    const rows = data || [];
    box.innerHTML = '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Name</th><th>Kind</th><th>Checked</th><th>Visibility</th><th>Placement (inactive)</th><th>Created</th><th></th></tr></thead><tbody>' +
      (rows.map(function (r) {
        const sample = r.is_sample;
        return '<tr><td><a href="' + PUBLIC[cat] + '?id=' + encodeURIComponent(r.id) + '" target="_blank" rel="noopener">' + esc(r[NAME[cat]]) + '</a></td>' +
          '<td>' + (sample ? '<span class="mk-sample">Sample</span>' : 'Genuine') + '</td>' +
          '<td>' + (r.verified ? '✓' : '—') + '</td><td>' + esc(r.moderation_status) + '</td>' +
          '<td>' + (sample ? '—' : '<select data-place="' + esc(r.id) + '" aria-label="Placement">' + ['standard', 'priority', 'featured'].map(function (p) { return '<option' + (r.placement === p ? ' selected' : '') + '>' + p + '</option>'; }).join('') + '</select>') + '</td>' +
          '<td>' + new Date(r.created_at).toLocaleDateString() + '</td>' +
          '<td class="table-actions">' + (sample ? '' : '<button class="btn btn-secondary btn-sm" data-verify="' + esc(r.id) + '" data-v="' + (!r.verified) + '">' + (r.verified ? 'Uncheck' : 'Mark checked') + '</button>') +
          '<button class="btn btn-secondary btn-sm" data-mod="' + esc(r.id) + '" data-s="' + (r.moderation_status === 'active' ? 'hidden' : 'active') + '">' + (r.moderation_status === 'active' ? 'Hide' : 'Unhide') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="7">Nothing yet.</td></tr>') + '</tbody></table></div>';
    box.querySelectorAll('[data-verify]').forEach(function (b) {
      b.addEventListener('click', async function () {
        b.disabled = true;
        const ok = cat === 'listing'
          ? await rpc('admin_set_listing_verified', { p_listing: b.getAttribute('data-verify'), p_verified: b.getAttribute('data-v') === 'true' })
          : await rpc('admin_set_entity_verified', { p_type: cat, p_id: b.getAttribute('data-verify'), p_verified: b.getAttribute('data-v') === 'true' });
        if (ok) renderEntities(); else b.disabled = false;
      });
    });
    box.querySelectorAll('[data-mod]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const note = b.getAttribute('data-s') === 'hidden' ? prompt('Reason for hiding (kept in the admin log):', '') : '';
        if (note === null) return;
        b.disabled = true;
        if (await rpc('admin_set_entity_moderation', { p_type: cat, p_id: b.getAttribute('data-mod'), p_status: b.getAttribute('data-s'), p_note: note || null })) renderEntities(); else b.disabled = false;
      });
    });
    box.querySelectorAll('[data-place]').forEach(function (s) {
      s.addEventListener('change', async function () {
        if (!confirm('Placement has no public effect until packages launch (paid placement is switched off). Save it anyway?')) { renderEntities(); return; }
        await rpc('admin_set_entity_placement', { p_type: cat, p_id: s.getAttribute('data-place'), p_placement: s.value, p_until: null });
        renderEntities();
      });
    });
  }

  async function accountNames(ids) {
    const names = {};
    if (ids.length) {
      const { data: profs } = await supabaseClient.from('profiles').select('id,full_name,role').in('id', ids);
      (profs || []).forEach(function (p) { names[p.id] = p.full_name + ' (' + p.role + ')'; });
    }
    return names;
  }

  async function renderEarly() {
    const box = document.getElementById('admEarly');
    // evaluated by the database before it is returned, so the list is never stale
    const { data } = await supabaseClient.rpc('admin_list_early_participants');
    const rows = data || [];
    const names = await accountNames(rows.map(function (r) { return r.user_id; }));
    const eligible = rows.filter(function (r) { return !r.revoked_at && r.qualifying_type !== 'none'; }).length;
    box.innerHTML = '<p class="my-sub">' + eligible + ' eligible. The database records an account when one genuine item, created before 1 Nov 2026, has stayed published for 7 days (samples, hidden and early-deleted content never count). ' +
      'Evaluation is automatic whenever eligibility is read (this list, the owner\'s dashboard, discount checks). The button below is a logged reconciliation run — use it once on or after <strong>8 Nov 2026</strong> for the record.</p>' +
      '<p><button class="btn btn-secondary btn-sm" id="admEarlyEval">Run evaluation now</button> <span class="my-msg" id="admEarlyMsg" role="status"></span></p>' +
      '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Account</th><th>Qualified</th><th>Qualifying item</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows.map(function (r) {
        const blockedEarly = r.qualifying_type === 'none';
        return '<tr><td>' + esc(names[r.user_id] || r.user_id) + '</td><td>' + (blockedEarly ? '—' : new Date(r.qualified_at).toLocaleDateString()) + '</td><td>' + esc(blockedEarly ? '—' : r.qualifying_type) + '</td><td>' + esc(r.source) + '</td>' +
          '<td>' + (r.revoked_at ? (blockedEarly ? 'Blocked before qualifying: ' : 'Revoked: ') + esc(r.revoked_reason || '') : 'Eligible') + '</td>' +
          '<td><button class="btn btn-secondary btn-sm" data-early="' + esc(r.user_id) + '" data-q="' + Boolean(r.revoked_at) + '">' + (r.revoked_at ? 'Restore' : 'Revoke') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="6">No early participants yet.</td></tr>') + '</tbody></table></div>';
    document.getElementById('admEarlyEval').addEventListener('click', async function (e) {
      e.target.disabled = true;
      const { data: n, error } = await supabaseClient.rpc('admin_evaluate_early_participants');
      document.getElementById('admEarlyMsg').textContent = error ? error.message : n + ' newly qualified.';
      if (!error) setTimeout(renderEarly, 1200); else e.target.disabled = false;
    });
    box.querySelectorAll('[data-early]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const restore = b.getAttribute('data-q') === 'true';
        const reason = prompt(restore ? 'Note for restoring (kept in the admin log):' : 'Reason for revoking (kept in the admin log):', '');
        if (reason === null) return;
        if (await rpc('admin_set_early_participant', { p_user: b.getAttribute('data-early'), p_qualified: restore, p_reason: reason || null })) renderEarly();
      });
    });
  }

  async function renderCaps() {
    const box = document.getElementById('admCaps');
    const { data } = await supabaseClient.from('account_capabilities').select('*').eq('capability', 'project_publisher').order('requested_at', { ascending: false }).limit(200);
    const rows = data || [];
    const names = await accountNames(rows.map(function (r) { return r.user_id; }));
    box.innerHTML = '<p class="my-sub">Any account can apply (developer application); approve or reject applications in the Developer applications queue above. Here you can revoke or restore an approved capability. The account role is never changed.</p>' +
      '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Account</th><th>Status</th><th>Decided</th><th>Note</th><th></th></tr></thead><tbody>' +
      (rows.map(function (r) {
        const act = r.status === 'approved' ? 'revoked' : r.status === 'revoked' ? 'approved' : null;
        return '<tr><td>' + esc(names[r.user_id] || r.user_id) + '</td><td>' + esc(r.status) + '</td><td>' + (r.decided_at ? new Date(r.decided_at).toLocaleDateString() : '—') + '</td><td>' + esc(r.note || '') + '</td>' +
          '<td>' + (act ? '<button class="btn btn-secondary btn-sm" data-cap="' + esc(r.user_id) + '" data-s="' + act + '">' + (act === 'revoked' ? 'Revoke' : 'Restore') + '</button>' : '') + '</td></tr>';
      }).join('') || '<tr><td colspan="5">No applications yet.</td></tr>') + '</tbody></table></div>';
    box.querySelectorAll('[data-cap]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const note = prompt('Reason (kept in the admin log):', '');
        if (note === null) return;
        if (await rpc('admin_set_capability', { p_user: b.getAttribute('data-cap'), p_cap: 'project_publisher', p_status: b.getAttribute('data-s'), p_note: note || null })) renderCaps();
      });
    });
  }

  async function renderSettings() {
    const box = document.getElementById('admSettings');
    const s = await (function () { return supabaseClient.from('marketplace_settings').select('key,value'); })();
    const map = {}; (s.data || []).forEach(function (r) { map[r.key] = r.value; });
    const counts = await Promise.all(['listings', 'projects', 'professionals', 'agencies', 'companies'].map(function (t) {
      return supabaseClient.from(t).select('id', { count: 'exact', head: true }).eq('is_sample', true).then(function (r) { return t + ': ' + (r.count || 0); });
    }));
    box.innerHTML =
      '<p><strong>Sample content:</strong> ' + esc(counts.join(' · ')) + '</p>' +
      '<p><label class="my-bool"><input type="checkbox" id="admSamplesVisible"' + (map.samples_visible !== false ? ' checked' : '') + '> Show samples where categories are thin</label></p>' +
      '<p><label>Top up homepage rows to <input type="number" id="admFillMin" min="0" max="10" value="' + esc(map.sample_fill_min == null ? 5 : map.sample_fill_min) + '" style="width:4.5rem"> cards</label> <button class="btn btn-secondary btn-sm" id="admSaveFill">Save</button></p>' +
      '<p class="my-sub">Removing samples permanently: run <code>supabase/seed/remove_marketplace_samples.sql</code> in the Supabase SQL editor (it only deletes rows marked as samples).</p>' +
      '<h4>Limits</h4>' +
      '<p><label>Enquiries per account per 24 hours <input type="number" id="admEnqLimit" min="1" max="200" value="' + esc(map.enquiry_daily_limit == null ? 20 : map.enquiry_daily_limit) + '" style="width:5rem"></label> <button class="btn btn-secondary btn-sm" data-setnum="enquiry_daily_limit" data-in="admEnqLimit" data-max="200">Save</button></p>' +
      '<p><label>Agency profiles per account <input type="number" id="admAgLimit" min="1" max="50" value="' + esc(map.max_agencies_per_account == null ? 2 : map.max_agencies_per_account) + '" style="width:4.5rem"></label> <button class="btn btn-secondary btn-sm" data-setnum="max_agencies_per_account" data-in="admAgLimit" data-max="50">Save</button>' +
      ' <label>Builder/developer profiles per account <input type="number" id="admCoLimit" min="1" max="50" value="' + esc(map.max_companies_per_account == null ? 2 : map.max_companies_per_account) + '" style="width:4.5rem"></label> <button class="btn btn-secondary btn-sm" data-setnum="max_companies_per_account" data-in="admCoLimit" data-max="50">Save</button></p>' +
      '<p class="my-sub">Professional profiles: always one per account. Early-benefit period: 7 days (set in the migration).</p>' +
      '<form id="admOverride" class="my-inline"><label>Raise one account\'s limit — account id <input id="admOvUser" type="text" size="38" placeholder="account uuid"></label>' +
        '<select id="admOvEntity" aria-label="Profile type"><option value="agencies">Agencies</option><option value="companies">Builders/developers</option></select>' +
        '<input id="admOvMax" type="number" min="1" max="50" placeholder="max" style="width:4.5rem" aria-label="Maximum">' +
        '<button class="btn btn-secondary btn-sm" type="submit">Save override</button><span class="my-sub"> (empty max = back to default)</span></form>' +
      '<p><strong>Paid placement:</strong> ' + (map.paid_placement_active === true ? 'ACTIVE' : 'Inactive until packages launch') + ' · <strong>Packages planned from:</strong> ' + esc(String(map.packages_launch_at || '').slice(0, 10)) + '</p>';
    document.getElementById('admSamplesVisible').addEventListener('change', function (e) { rpc('admin_set_marketplace_setting', { p_key: 'samples_visible', p_value: e.target.checked }); });
    box.querySelectorAll('[data-setnum]').forEach(function (b) {
      b.addEventListener('click', function () {
        const n = Math.round(Number(document.getElementById(b.getAttribute('data-in')).value));
        if (!(n >= 1 && n <= Number(b.getAttribute('data-max')))) { alert('Enter a whole number from 1 to ' + b.getAttribute('data-max') + '.'); return; }
        rpc('admin_set_marketplace_setting', { p_key: b.getAttribute('data-setnum'), p_value: n });
      });
    });
    document.getElementById('admOverride').addEventListener('submit', async function (e) {
      e.preventDefault();
      const max = document.getElementById('admOvMax').value;
      const note = prompt('Reason (kept in the admin log):', '');
      if (note === null) return;
      if (await rpc('admin_set_entity_limit', { p_user: document.getElementById('admOvUser').value.trim(), p_entity: document.getElementById('admOvEntity').value, p_max: max === '' ? null : Math.round(Number(max)), p_note: note || null })) alert('Saved.');
    });
    document.getElementById('admSaveFill').addEventListener('click', function () { rpc('admin_set_marketplace_setting', { p_key: 'sample_fill_min', p_value: Math.max(0, Math.min(10, Number(document.getElementById('admFillMin').value) || 0)) }); });
  }

  async function renderCities() {
    const box = document.getElementById('admCities');
    const { data } = await supabaseClient.from('cities').select('name,active').order('sort_order');
    box.innerHTML = '<ul class="my-list">' + (data || []).map(function (c) {
      return '<li><span>' + esc(c.name) + ' — ' + (c.active ? 'active' : 'coming later') + '</span><button class="btn btn-secondary btn-sm" data-city="' + esc(c.name) + '" data-a="' + (!c.active) + '">' + (c.active ? 'Deactivate' : 'Activate') + '</button></li>';
    }).join('') + '</ul>' +
      '<form id="admArea" class="my-inline"><label>Add an area: <select id="admAreaCity">' + (data || []).map(function (c) { return '<option>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
      '<input id="admAreaName" type="text" maxlength="80" placeholder="Area / society name"><button class="btn btn-secondary btn-sm" type="submit">Add area</button></form>';
    box.querySelectorAll('[data-city]').forEach(function (b) {
      b.addEventListener('click', async function () {
        if (!confirm('Change whether listings can be posted in ' + b.getAttribute('data-city') + '?')) return;
        if (await rpc('admin_set_city_active', { p_city: b.getAttribute('data-city'), p_active: b.getAttribute('data-a') === 'true' })) renderCities();
      });
    });
    document.getElementById('admArea').addEventListener('submit', async function (e) {
      e.preventDefault();
      if (await rpc('admin_add_area', { p_city: document.getElementById('admAreaCity').value, p_area: document.getElementById('admAreaName').value })) { alert('Area added.'); renderCities(); }
    });
  }

  root.querySelectorAll('[data-cat]').forEach(function (b) {
    b.addEventListener('click', function () {
      cat = b.getAttribute('data-cat');
      root.querySelectorAll('[data-cat]').forEach(function (x) { x.classList.toggle('btn-primary', x === b); x.classList.toggle('btn-secondary', x !== b); });
      renderEntities();
    });
  });

  (async function () {
    const admin = await AcDB.currentUser();
    if (!admin || admin.role !== 'admin') return;
    renderEntities(); renderEarly(); renderCaps(); renderSettings(); renderCities();
  })();
})();
