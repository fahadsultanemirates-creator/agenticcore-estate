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
    const user = await requireAuth(['developer']);
    if (!user) return;

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
      const cities = await AcDB.getActiveCities();
      citySelect.innerHTML = '<option value="">Select a city</option>' +
        cities.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
      citySelect.addEventListener('change', async function () {
        if (!citySelect.value) { areaSelect.innerHTML = '<option value="">Select a city first</option>'; return; }
        areaSelect.innerHTML = '<option value="">Loading…</option>';
        const areas = await AcDB.getAreasForCity(citySelect.value);
        areaSelect.innerHTML = '<option value="">Select an area</option>' +
          areas.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('') +
          '<option value="' + MANUAL_AREA_VALUE + '">Other — type it in</option>';
        toggleManualArea();
      });
      areaSelect.addEventListener('change', toggleManualArea);
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

      const result = await AcDB.addProject({
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
        brochureFile: brochureFile
      });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post project';
        return;
      }

      window.location.href = 'developer-dashboard.html?posted=1';
    });
  })();
}
