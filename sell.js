// AgenticCore Estate — list-your-property form

const sellForm = document.getElementById('sellForm');
if (sellForm) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller', 'developer']);
    if (!user) return;

    const cnicGroup = document.getElementById('sellCnicGroup');
    const citySelect = document.getElementById('sellCity');
    const areaSelect = document.getElementById('sellArea');
    const typeSelect = document.getElementById('sellPropertyType');

    if (typeSelect) typeSelect.innerHTML = acPropertyTypeOptionsHTML();

    if (citySelect) {
      const cities = await AcDB.getActiveCities();
      citySelect.innerHTML = '<option value="">Select a city</option>' +
        cities.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('');
      citySelect.addEventListener('change', async function () {
        if (!citySelect.value) { areaSelect.innerHTML = '<option value="">Select a city first</option>'; return; }
        areaSelect.innerHTML = '<option value="">Loading…</option>';
        const areas = await AcDB.getAreasForCity(citySelect.value);
        areaSelect.innerHTML = '<option value="">Select an area</option>' +
          areas.map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
      });
    }

    // Individual sellers (not developers) need a CNIC on file before their
    // first listing goes public — developers already provided one at
    // verification. Buyers/browsers never see this unless they try to sell.
    const needsCnic = user.role !== 'developer' && !user.cnic;
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
      const area = areaSelect.value;
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

      const result = await AcDB.addListing({
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
        description: document.getElementById('sellDescription').value.trim(),
        photoFiles: photoFiles
      });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post listing';
        return;
      }

      window.location.href = 'listing.html?id=' + result.listing.id + '&posted=1';
    });
  })();
}
