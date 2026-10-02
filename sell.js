// AgenticCore Estate — list-your-property form

const sellForm = document.getElementById('sellForm');
if (sellForm) {
  (async function () {
    // Any account can list a property (owners, professionals, agencies, builders, projects).
    const user = await requireAuth();
    if (!user) return;

    const cnicGroup = document.getElementById('sellCnicGroup');
    const citySelect = document.getElementById('sellCity');
    const areaSelect = document.getElementById('sellArea');
    const areaManual = document.getElementById('sellAreaManual');
    const typeSelect = document.getElementById('sellPropertyType');
    const sizeUnitSelect = document.getElementById('sellSizeUnit');

    if (typeSelect) typeSelect.innerHTML = acPropertyTypeOptionsHTML();
    if (sizeUnitSelect) {
      sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML(AC_DEFAULT_SIZE_UNIT[typeSelect.value]);
      typeSelect.addEventListener('change', function () {
        sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML(AC_DEFAULT_SIZE_UNIT[typeSelect.value]);
      });
    }

    const MANUAL_AREA_VALUE = '__manual__';
    function toggleManualArea() {
      const isManual = areaSelect.value === MANUAL_AREA_VALUE;
      areaManual.style.display = isManual ? 'block' : 'none';
      areaManual.required = isManual;
    }

    async function loadAreas() {
      if (!citySelect.value) { areaSelect.innerHTML = '<option value="">Select a city first</option>'; return []; }
      areaSelect.innerHTML = '<option value="">Loading…</option>';
      const areas = await AcDB.getAreasForCity(citySelect.value);
      areaSelect.innerHTML = '<option value="">Select an area</option>' +
        areas.map(function (a) { return '<option value="' + acEsc(a) + '">' + acEsc(a) + '</option>'; }).join('') +
        '<option value="' + MANUAL_AREA_VALUE + '">Other — type it in</option>';
      toggleManualArea();
      return areas;
    }

    if (citySelect) {
      const cities = await AcDB.getActiveCities();
      citySelect.innerHTML = '<option value="">Select a city</option>' +
        cities.map(function (c) { return '<option value="' + acEsc(c) + '">' + acEsc(c) + '</option>'; }).join('');
      citySelect.addEventListener('change', function () { loadAreas(); });
      areaSelect.addEventListener('change', toggleManualArea);
    }

    // ---------- optional marketplace links (agency / professional / project) ----------
    // The options are only what this account controls; the database checks again.
    async function loadLinks(current) {
      if (typeof AcMine === 'undefined') return;
      const mine = await AcMine.overview(user.id);
      const agencies = await AcMine.listingAgencies(user.id, mine.professionals);
      function fill(wrapId, selId, rows, label, value) {
        const wrap = document.getElementById(wrapId), sel = document.getElementById(selId);
        if (!rows.length) { wrap.hidden = true; return false; }
        sel.innerHTML = '<option value="">—</option>' + rows.map(function (r) { return '<option value="' + acEsc(r.id) + '">' + acEsc(label(r)) + '</option>'; }).join('');
        if (value) sel.value = value;
        wrap.hidden = false; return true;
      }
      const a = fill('sellAgencyWrap', 'sellAgency', agencies, function (r) { return r.name; }, current && current.agency_id);
      const p = fill('sellProfWrap', 'sellProfessional', mine.professionals, function (r) { return r.display_name; }, current && current.professional_id);
      const j = fill('sellProjWrap', 'sellProject', mine.projects, function (r) { return r.title; }, current && current.project_id);
      document.getElementById('sellLinks').hidden = !(a || p || j);
      if (!current && agencies.length === 1 && user.role === 'agency') document.getElementById('sellAgency').value = agencies[0].id;
      if (!current && mine.professionals.length === 1) document.getElementById('sellProfessional').value = mine.professionals[0].id;
    }

    // ---------- edit mode: sell.html?edit=<listing id> ----------
    const editId = new URLSearchParams(window.location.search).get('edit');
    let editing = null;
    if (editId) {
      editing = await AcDB.getListing(editId);
      if (!editing || (editing.owner_id !== user.id && user.role !== 'admin')) {
        const errorEl = document.getElementById('sellError');
        errorEl.textContent = 'That listing was not found or is not yours to edit.';
        errorEl.style.display = 'block';
        editing = null;
      } else {
        document.querySelector('.inner-hero h1').textContent = 'Edit your listing';
        document.title = 'Edit listing — AgenticCore Estate';
        const radio = document.querySelector('input[name="sellType"][value="' + editing.type + '"]');
        if (radio) {
          radio.checked = true;
          document.querySelectorAll('.role-option').forEach(function (o) { o.classList.toggle('checked', o.contains(radio)); });
        }
        typeSelect.value = editing.property_type;
        sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML(editing.size_unit || AC_DEFAULT_SIZE_UNIT[typeSelect.value]);
        document.getElementById('sellTitle').value = editing.title;
        document.getElementById('sellPrice').value = editing.price;
        document.getElementById('sellSize').value = editing.size_marla;
        document.getElementById('sellBeds').value = editing.beds || '';
        document.getElementById('sellBaths').value = editing.baths || '';
        document.getElementById('sellDescription').value = editing.description || '';
        citySelect.value = editing.city;
        const areas = await loadAreas();
        if (areas.indexOf(editing.area) >= 0) areaSelect.value = editing.area;
        else { areaSelect.value = MANUAL_AREA_VALUE; areaManual.value = editing.area; }
        toggleManualArea();
        const count = (editing.photos || []).length;
        document.querySelector('label[for="sellPhotos"]').textContent = 'Add more photos (' + count + ' of 8 used)';
        sellForm.querySelector('button[type="submit"]').textContent = 'Save changes';
      }
    }

    loadLinks(editing).catch(function () {});

    // ---------- live listing quality (deterministic, see listing-quality.js) ----------
    const qualitySlot = document.getElementById('sellQuality');
    const photoInputEl = document.getElementById('sellPhotos');
    function formListing() {
      const selected = photoInputEl && photoInputEl.files ? Math.min(photoInputEl.files.length, 8) : 0;
      const existing = editing ? (editing.photos || []).length : 0;
      return {
        title: document.getElementById('sellTitle').value,
        description: document.getElementById('sellDescription').value,
        price: Number(document.getElementById('sellPrice').value) || 0,
        area: areaSelect.value === MANUAL_AREA_VALUE ? areaManual.value : areaSelect.value,
        city: citySelect.value,
        property_type: typeSelect.value,
        size_marla: Number(document.getElementById('sellSize').value) || 0,
        beds: Number(document.getElementById('sellBeds').value) || 0,
        baths: Number(document.getElementById('sellBaths').value) || 0,
        photos: new Array(Math.min(existing + selected, 8)).fill('x'),
        verified: editing ? editing.verified : false,
        created_at: new Date().toISOString()
      };
    }
    let qTimer = null;
    function refreshQuality() {
      clearTimeout(qTimer);
      qTimer = setTimeout(function () {
        if (qualitySlot && typeof acListingQualityWidget === 'function') qualitySlot.innerHTML = acListingQualityWidget(formListing(), { maxTips: 3 });
      }, 150);
    }
    sellForm.addEventListener('input', refreshQuality);
    sellForm.addEventListener('change', refreshQuality);
    refreshQuality();

    // ---------- "Let AgenticCore help me list" (never publishes) ----------
    const modeForm = document.getElementById('modeForm');
    const modeAssist = document.getElementById('modeAssist');
    const assistBox = document.getElementById('assistBox');
    const assistOut = document.getElementById('assistOut');
    function setAssist(on) {
      assistBox.hidden = !on;
      modeAssist.classList.toggle('active', on); modeAssist.setAttribute('aria-pressed', on ? 'true' : 'false');
      modeForm.classList.toggle('active', !on); modeForm.setAttribute('aria-pressed', on ? 'false' : 'true');
      if (on) document.getElementById('assistText').focus();
    }
    modeForm.addEventListener('click', function () { setAssist(false); });
    modeAssist.addEventListener('click', function () { setAssist(true); });
    if (!editing && new URLSearchParams(window.location.search).get('assist')) setAssist(true);
    if (editing) document.querySelector('.sell-modes').hidden = true;

    let lastDraft = null;
    document.getElementById('assistBtn').addEventListener('click', async function () {
      const btn = this;
      const text = document.getElementById('assistText').value.trim();
      if (text.length < 8) { assistOut.innerHTML = '<p>' + acEsc(acT('sell_assist_short')) + '</p>'; return; }
      btn.disabled = true;
      assistOut.innerHTML = '<p role="status">' + acEsc(acT('sell_assist_working')) + '</p>';
      const res = await AcCopilot.call({ action: 'draft', text: text }, true);
      btn.disabled = false;
      if (res.error) {
        assistOut.innerHTML = '<p>' + acEsc(res.error) + '</p><p style="color:var(--text-tertiary);font-size:0.85rem;">' + acEsc(acT('sell_assist_fallback')) + '</p>';
        return;
      }
      lastDraft = res;
      const f = res.facts || {};
      const known = [];
      if (f.purpose) known.push(f.purpose === 'rent' ? 'For rent' : 'For sale');
      if (f.property_type) known.push(acPropertyTypeLabel(f.property_type));
      if (f.size_value) known.push(f.size_value + ' ' + acSizeUnitLabel(f.size_unit || 'marla'));
      if (f.beds) known.push(f.beds + ' bed');
      if (f.baths) known.push(f.baths + ' bath');
      if (f.area || f.city) known.push([f.area, f.city].filter(Boolean).join(', '));
      if (f.price) known.push(acFormatPKR(f.price));
      (f.features || []).forEach(function (x) { known.push(x); });
      const d = res.draft || {};
      assistOut.innerHTML =
        '<div><h5>' + acEsc(acT('sell_assist_known')) + '</h5><p>' + (known.length ? known.map(acEsc).join(' · ') : '—') + '</p></div>' +
        '<div><h5>' + acEsc(acT('sell_assist_draft')) + (res.ai_used ? '' : ' <span class="badge badge-muted">' + acEsc(acT('sell_assist_template')) + '</span>') + '</h5>' +
          '<div class="assist-draft"><strong>' + acEsc(d.title || '') + '</strong>' + acEsc(d.description || '') +
          (res.ai_used && (d.bullets || []).length ? '\n\n' + d.bullets.map(function (b) { return '• ' + acEsc(b); }).join('\n') : '') + '</div></div>' +
        ((res.missing || []).length ? '<div class="assist-missing"><h5>' + acEsc(acT('sell_assist_missing')) + '</h5><ul>' + res.missing.map(function (m) { return '<li>' + acEsc(m.label) + '</li>'; }).join('') + '</ul></div>' : '') +
        ((d.photo_order || []).length ? '<div><h5>' + acEsc(acT('sell_assist_photos')) + '</h5><p>' + d.photo_order.map(acEsc).join(' → ') + '</p></div>' : '') +
        ((d.keywords || []).length ? '<div><h5>' + acEsc(acT('sell_assist_keywords')) + '</h5><p>' + d.keywords.map(acEsc).join(', ') + '</p></div>' : '') +
        '<div><button type="button" class="btn btn-primary btn-sm" id="assistApply">' + acEsc(acT('sell_assist_apply')) + '</button>' +
        '<p style="font-size:0.8rem;color:var(--text-tertiary);margin-top:0.4rem;">' + acEsc(acT('sell_assist_review')) + '</p></div>';
      document.getElementById('assistApply').addEventListener('click', applyDraft);
    });

    async function applyDraft() {
      if (!lastDraft) return;
      const f = lastDraft.facts || {}, d = lastDraft.draft || {};
      const filled = [];
      function set(id, v) { if (v === null || v === undefined || v === '') return; const el = document.getElementById(id); el.value = v; filled.push(el); }
      if (f.purpose) {
        const radio = document.querySelector('input[name="sellType"][value="' + f.purpose + '"]');
        if (radio) { radio.checked = true; document.querySelectorAll('.role-option').forEach(function (o) { o.classList.toggle('checked', o.contains(radio)); }); }
      }
      if (f.property_type && typeSelect.querySelector('option[value="' + f.property_type + '"]')) {
        typeSelect.value = f.property_type; filled.push(typeSelect);
        sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML(AC_DEFAULT_SIZE_UNIT[typeSelect.value]);
      }
      if (f.size_unit && sizeUnitSelect.querySelector('option[value="' + f.size_unit + '"]')) sizeUnitSelect.value = f.size_unit;
      set('sellTitle', d.title);
      // The basic (non-AI) draft already lists the key details in its description.
      set('sellDescription', [d.description, lastDraft.ai_used ? (d.bullets || []).map(function (b) { return '• ' + b; }).join('\n') : ''].filter(Boolean).join('\n\n'));
      set('sellPrice', f.price);
      set('sellSize', f.size_value);
      set('sellBeds', f.beds);
      set('sellBaths', f.baths);
      if (f.city && citySelect.querySelector('option[value="' + f.city + '"]')) {
        citySelect.value = f.city; filled.push(citySelect);
        const areas = await loadAreas();
        if (f.area) {
          // Exact name, else the one known area containing every word the owner used ("Bahria Phase 7" → "Bahria Town Phase 7").
          const words = function (x) { return String(x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' '); };
          const want = words(f.area);
          const close = areas.filter(function (a) { const have = words(a); return want.every(function (t) { return have.indexOf(t) >= 0; }); });
          const match = areas.indexOf(f.area) >= 0 ? f.area : (close.length === 1 ? close[0] : null);
          if (match) { areaSelect.value = match; toggleManualArea(); filled.push(areaSelect); }
          else { areaSelect.value = MANUAL_AREA_VALUE; toggleManualArea(); areaManual.value = f.area; filled.push(areaManual); }
        }
      }
      filled.forEach(function (el) { el.classList.add('field-filled'); el.addEventListener('input', function () { el.classList.remove('field-filled'); }, { once: true }); });
      refreshQuality();
      document.getElementById('sellTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ---------- duplicate-post guard ----------
    let ownListings = null;
    async function looksDuplicate(payload) {
      if (editing) return null;
      if (!ownListings) ownListings = await AcDB.getListingsByOwner(user.id).catch(function () { return []; });
      const t = payload.title.toLowerCase().replace(/\s+/g, ' ').trim();
      return ownListings.find(function (l) {
        return Number(l.price) === payload.price && (String(l.title).toLowerCase().replace(/\s+/g, ' ').trim() === t ||
          (l.area === payload.area && Number(l.size_marla) === payload.sizeMarla && l.property_type === payload.propertyType));
      }) || null;
    }

    // CNIC verification is switched off for the initial launch window so
    // sellers can list quickly; the form field and update logic stay in
    // place to switch back on later without rebuilding this flow.
    const needsCnic = false;
    if (needsCnic && cnicGroup) {
      cnicGroup.style.display = 'block';
    }

    sellForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('sellError');
      const submitBtn = sellForm.querySelector('button[type="submit"]');
      errorEl.style.display = 'none';

      if (needsCnic) {
        const cnicInput = document.getElementById('sellCnic');
        const cnic = cnicInput.value.trim();
        if (cnic.replace(/\D/g, '').length < 13) {
          errorEl.textContent = 'Enter a valid 13-digit CNIC number to verify your listing.';
          errorEl.style.display = 'block';
          return;
        }
        await AcDB.updateUser(user.id, { cnic: cnic });
      }

      const city = citySelect.value;
      const area = areaSelect.value === MANUAL_AREA_VALUE ? areaManual.value.trim() : areaSelect.value;
      const propertyType = typeSelect.value;
      if (!city || !area || !propertyType) {
        errorEl.textContent = 'Please select a property type, city, and area.';
        errorEl.style.display = 'block';
        return;
      }

      const photoInput = document.getElementById('sellPhotos');
      const photoFiles = photoInput && photoInput.files ? Array.from(photoInput.files).slice(0, 8) : [];

      submitBtn.disabled = true;
      submitBtn.textContent = photoFiles.length ? 'Uploading photos…' : 'Posting…';

      const payload = {
        ownerId: user.id,
        title: document.getElementById('sellTitle').value.trim(),
        type: document.querySelector('input[name="sellType"]:checked').value,
        propertyType: propertyType,
        city: city,
        area: area,
        price: Number(document.getElementById('sellPrice').value),
        beds: Number(document.getElementById('sellBeds').value) || 0,
        baths: Number(document.getElementById('sellBaths').value) || 0,
        sizeMarla: Number(document.getElementById('sellSize').value) || 0,
        sizeUnit: sizeUnitSelect.value,
        description: document.getElementById('sellDescription').value.trim(),
        photoFiles: photoFiles,
        agencyId: document.getElementById('sellAgency') ? document.getElementById('sellAgency').value : '',
        professionalId: document.getElementById('sellProfessional') ? document.getElementById('sellProfessional').value : '',
        projectId: document.getElementById('sellProject') ? document.getElementById('sellProject').value : ''
      };
      const dup = await looksDuplicate(payload);
      if (dup && !confirm(acT('sell_dup_confirm').replace('{title}', dup.title))) {
        const warn = document.getElementById('sellWarn');
        warn.innerHTML = acEsc(acT('sell_dup_warn')) + ' <a href="listing.html?id=' + encodeURIComponent(dup.id) + '" style="color:var(--accent-gold-bright);">' + acEsc(dup.title) + '</a>';
        warn.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post listing';
        return;
      }

      const result = editing
        ? await AcDB.updateListing(editing.id, editing.owner_id, payload)
        : await AcDB.addListing(payload);

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = editing ? 'Save changes' : 'Post listing';
        return;
      }

      window.location.href = 'listing.html?id=' + encodeURIComponent(result.listing.id) + (editing ? '&saved=1' : '&posted=1');
    });
  })();
}
