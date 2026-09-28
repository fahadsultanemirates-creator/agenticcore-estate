// AgenticCore Estate — list-your-property form

const sellForm = document.getElementById('sellForm');
if (sellForm) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller', 'developer', 'agency', 'admin']);
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
        const areas = await AcDB.getAreasForCity(editing.city);
        areaSelect.innerHTML = '<option value="">Select an area</option>' +
          areas.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('') +
          '<option value="' + MANUAL_AREA_VALUE + '">Other — type it in</option>';
        if (areas.indexOf(editing.area) >= 0) areaSelect.value = editing.area;
        else { areaSelect.value = MANUAL_AREA_VALUE; areaManual.value = editing.area; }
        toggleManualArea();
        const count = (editing.photos || []).length;
        document.querySelector('label[for="sellPhotos"]').textContent = 'Add more photos (' + count + ' of 8 used)';
        sellForm.querySelector('button[type="submit"]').textContent = 'Save changes';
      }
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
        photoFiles: photoFiles
      };
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
