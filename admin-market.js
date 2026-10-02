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

  async function renderEarly() {
    const box = document.getElementById('admEarly');
    const { data } = await supabaseClient.from('early_participants').select('*').order('qualified_at', { ascending: true }).limit(200);
    const rows = data || [];
    const ids = rows.map(function (r) { return r.user_id; });
    const names = {};
    if (ids.length) {
      const { data: profs } = await supabaseClient.from('profiles').select('id,full_name,role').in('id', ids);
      (profs || []).forEach(function (p) { names[p.id] = p.full_name + ' (' + p.role + ')'; });
    }
    box.innerHTML = '<p class="my-sub">' + rows.filter(function (r) { return !r.revoked_at; }).length + ' eligible. Recorded by the database when genuine content is created before packages launch; samples never qualify.</p>' +
      '<div style="overflow-x:auto"><table class="data-table"><thead><tr><th>Account</th><th>Qualified</th><th>First content</th><th>Source</th><th>Status</th><th></th></tr></thead><tbody>' +
      (rows.map(function (r) {
        return '<tr><td>' + esc(names[r.user_id] || r.user_id) + '</td><td>' + new Date(r.qualified_at).toLocaleDateString() + '</td><td>' + esc(r.qualifying_type) + '</td><td>' + esc(r.source) + '</td>' +
          '<td>' + (r.revoked_at ? 'Revoked: ' + esc(r.revoked_reason || '') : 'Eligible') + '</td>' +
          '<td><button class="btn btn-secondary btn-sm" data-early="' + esc(r.user_id) + '" data-q="' + Boolean(r.revoked_at) + '">' + (r.revoked_at ? 'Restore' : 'Revoke') + '</button></td></tr>';
      }).join('') || '<tr><td colspan="6">No early participants yet.</td></tr>') + '</tbody></table></div>';
    box.querySelectorAll('[data-early]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const restore = b.getAttribute('data-q') === 'true';
        const reason = restore ? null : prompt('Reason for revoking (kept in the admin log):', '');
        if (!restore && reason === null) return;
        if (await rpc('admin_set_early_participant', { p_user: b.getAttribute('data-early'), p_qualified: restore, p_reason: reason })) renderEarly();
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
      '<p><strong>Paid placement:</strong> ' + (map.paid_placement_active === true ? 'ACTIVE' : 'Inactive until packages launch') + ' · <strong>Packages planned from:</strong> ' + esc(String(map.packages_launch_at || '').slice(0, 10)) + '</p>';
    document.getElementById('admSamplesVisible').addEventListener('change', function (e) { rpc('admin_set_marketplace_setting', { p_key: 'samples_visible', p_value: e.target.checked }); });
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
    renderEntities(); renderEarly(); renderSettings(); renderCities();
  })();
})();
