// AgenticCore Estate — project (whole-development) listing form + display helpers

function acProjectUnitTypeLabel(types) {
  if (!types || !types.length) return '—';
  const labels = types.map(acPropertyTypeLabel);
  if (labels.length <= 2) return labels.join(', ');
  return labels.slice(0, 2).join(', ') + ', +' + (labels.length - 2) + ' more';
}

function acProjectStatusLabel(status) {
  return status === 'under_construction' ? 'Under construction' : status === 'ready' ? 'Ready' : 'Off-plan';
}

const projectForm = document.getElementById('projectForm');
if (projectForm) {
  (async function () {
    const user = await requireAuth();
    if (!user) return;
    // Posting projects needs the approved project-publisher capability (the projects
    // insert policy in 0018 enforces it); any account can apply for it.
    if (user.role !== 'admin') {
      const cap = await acCapabilityStatus();
      if (cap !== 'approved') { window.location.href = cap === 'pending' ? 'developer-pending.html' : 'my.html#projects'; return; }
    }

    const citySelect = document.getElementById('projCity');
    const areaSelect = document.getElementById('projArea');
    const areaManual = document.getElementById('projAreaManual');
    const sizeUnitSelect = document.getElementById('projSizeUnit');
    const unitTypesEl = document.getElementById('projUnitTypes');
    const brochureInput = document.getElementById('projBrochureFile');
    const brochureDrop = document.getElementById('projBrochureDrop');

    if (sizeUnitSelect) sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML('sqft');

    if (unitTypesEl) {
      unitTypesEl.innerHTML = AC_PROPERTY_TYPES.map(function (t) {
        return '<label style="display:flex;align-items:center;gap:0.4rem;font-size:0.85rem;color:var(--text-secondary);cursor:pointer;">' +
          '<input type="checkbox" name="unitType" value="' + t.value + '"> ' + t.label + '</label>';
      }).join('');
    }

    if (brochureDrop && brochureInput) {
      const label = brochureDrop.querySelector('.file-drop-label');
      brochureDrop.addEventListener('click', function () { brochureInput.click(); });
      brochureInput.addEventListener('change', function () {
        if (brochureInput.files && brochureInput.files[0]) {
          brochureDrop.classList.add('has-file');
          if (label) label.textContent = '✓ ' + brochureInput.files[0].name;
        }
      });
    }

    const MANUAL_AREA_VALUE = '__manual__';
    function toggleManualArea() {
      const isManual = areaSelect.value === MANUAL_AREA_VALUE;
      areaManual.style.display = isManual ? 'block' : 'none';
      areaManual.required = isManual;
    }

    if (citySelect) {
      // projects can also be in Murree, the Galiyat, Gilgit-Baltistan, … (grouped by province)
      citySelect.innerHTML = '<option value="">Select a city or place</option>' + acPlaceOptionsHTML(await AcDB.getActiveCityRows(true));
      citySelect.setAttribute('data-city-select', '');
      citySelect.addEventListener('change', async function () {
        if (!citySelect.value) { areaSelect.innerHTML = '<option value="">Select a city first</option>'; return; }
        areaSelect.innerHTML = '<option value="">Loading…</option>';
        const areas = await AcDB.getAreasForCity(citySelect.value);
        areaSelect.innerHTML = '<option value="">Select an area</option>' +
          acAreaOptions(areas) +
          '<option value="' + MANUAL_AREA_VALUE + '">' + acEscHTML(acT('city_area_other')) + '</option>';
        toggleManualArea();
      });
      areaSelect.addEventListener('change', toggleManualArea);
    }

    // Developer company profiles this account owns (Marketplace V2 link).
    const companySel = document.getElementById('projCompany');
    if (companySel && typeof AcMine !== 'undefined') {
      const mine = await AcMine.overview(user.id);
      if (mine.companies.length) {
        companySel.innerHTML = '<option value="">—</option>' + mine.companies.map(function (c) { return '<option value="' + acEscHTML(c.id) + '">' + acEscHTML(c.name) + '</option>'; }).join('');
        document.getElementById('projCompanyWrap').hidden = false;
        if (mine.companies.length === 1) companySel.value = mine.companies[0].id;
      }
    }

    // ---------- edit mode: post-project.html?edit=<project id> ----------
    const editId = new URLSearchParams(location.search).get('edit');
    let editing = null;
    if (editId) {
      editing = await AcDB.getProject(editId);
      if (!editing || editing.owner_id !== user.id) { editing = null; }
      else {
        document.getElementById('projTitle').value = editing.title;
        citySelect.value = editing.city;
        citySelect.dispatchEvent(new Event('change'));
        await new Promise(function (r) { setTimeout(r, 400); });
        if (Array.from(areaSelect.options).some(function (o) { return o.value === editing.area; })) areaSelect.value = editing.area;
        else { areaSelect.value = MANUAL_AREA_VALUE; areaManual.value = editing.area; }
        toggleManualArea();
        const st = projectForm.querySelector('input[name="projStatus"][value="' + editing.status + '"]');
        if (st) { st.checked = true; projectForm.querySelectorAll('.role-option').forEach(function (o) { o.classList.toggle('checked', o.contains(st)); }); }
        (editing.unit_types || []).forEach(function (u) { const c = projectForm.querySelector('input[name="unitType"][value="' + u + '"]'); if (c) c.checked = true; });
        [['projTotalUnits', 'total_units'], ['projTotalPlots', 'total_plots'], ['projSizeFrom', 'size_from'], ['projSizeTo', 'size_to'], ['projPriceFrom', 'price_from'],
         ['projPriceTo', 'price_to'], ['projPaymentPlan', 'payment_plan'], ['projPossession', 'possession_date'], ['projDescription', 'description'], ['projApprovals', 'approvals_info'], ['projType', 'project_type']]
          .forEach(function (m) { const el = document.getElementById(m[0]); if (el && editing[m[1]] != null) el.value = editing[m[1]]; });
        sizeUnitSelect.innerHTML = acSizeUnitOptionsHTML(editing.size_unit || 'sqft');
        if (companySel && editing.company_id) companySel.value = editing.company_id;
        projectForm.querySelector('button[type="submit"]').textContent = acT('my_save');
      }
    }

    projectForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('projectError');
      const submitBtn = projectForm.querySelector('button[type="submit"]');
      errorEl.style.display = 'none';

      const city = citySelect.value;
      const area = areaSelect.value === MANUAL_AREA_VALUE ? areaManual.value.trim() : areaSelect.value;
      const unitTypes = Array.from(projectForm.querySelectorAll('input[name="unitType"]:checked')).map(function (i) { return i.value; });

      if (!city || !area) {
        errorEl.textContent = 'Please select a city and area.';
        errorEl.style.display = 'block';
        return;
      }
      if (!unitTypes.length) {
        errorEl.textContent = 'Select at least one unit type on offer.';
        errorEl.style.display = 'block';
        return;
      }

      const photoInput = document.getElementById('projPhotos');
      const photoFiles = photoInput && photoInput.files ? Array.from(photoInput.files).slice(0, 8) : [];
      const brochureFile = brochureInput.files && brochureInput.files[0] ? brochureInput.files[0] : null;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting…';

      const payload = {
        ownerId: user.id,
        title: document.getElementById('projTitle').value.trim(),
        city: city,
        area: area,
        status: document.querySelector('input[name="projStatus"]:checked').value,
        unitTypes: unitTypes,
        totalUnits: Number(document.getElementById('projTotalUnits').value) || null,
        totalPlots: Number(document.getElementById('projTotalPlots').value) || null,
        sizeFrom: Number(document.getElementById('projSizeFrom').value) || null,
        sizeTo: Number(document.getElementById('projSizeTo').value) || null,
        sizeUnit: sizeUnitSelect.value,
        priceFrom: Number(document.getElementById('projPriceFrom').value) || null,
        priceTo: Number(document.getElementById('projPriceTo').value) || null,
        paymentPlan: document.getElementById('projPaymentPlan').value.trim(),
        possessionDate: document.getElementById('projPossession').value.trim(),
        description: document.getElementById('projDescription').value.trim(),
        photoFiles: photoFiles,
        brochureFile: brochureFile,
        projectType: document.getElementById('projType').value,
        approvalsInfo: document.getElementById('projApprovals').value.trim(),
        companyId: companySel ? companySel.value : ''
      };
      const result = editing ? await AcDB.updateProject(editing.id, payload) : await AcDB.addProject(payload);

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post project';
        return;
      }

      window.location.href = 'my.html#projects';
    });
  })();
}
