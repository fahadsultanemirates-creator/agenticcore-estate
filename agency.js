// AgenticCore Estate — agency setup and dashboard

function acWireLogoDrop(inputId, dropId) {
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

// -------- setup form (first time only) --------
const agencySetupForm = document.getElementById('agencySetupForm');
if (agencySetupForm) {
  (async function () {
    const user = await requireAuth(['agency']);
    if (!user) return;
    if (user.agency_name) { window.location.href = 'agency-dashboard.html'; return; }

    acWireLogoDrop('agencyLogoFile', 'agencyLogoDrop');

    agencySetupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('authError');
      const submitBtn = agencySetupForm.querySelector('button[type="submit"]');
      errorEl.style.display = 'none';

      const agencyName = document.getElementById('agencyName').value.trim();
      const agencyDescription = document.getElementById('agencyDescription').value.trim();
      const logoInput = document.getElementById('agencyLogoFile');
      const logoFile = logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Setting up…';

      const result = await AcDB.updateAgencyProfile(user.id, { agencyName, agencyDescription, logoFile });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create agency dashboard';
        return;
      }

      window.location.href = 'agency-dashboard.html';
    });
  })();
}

// -------- dashboard --------
const agencyDashRoot = document.getElementById('agencyDashRoot');
if (agencyDashRoot) {
  (async function () {
    const user = await requireAuth(['agency']);
    if (!user) return;
    if (!user.agency_name) { window.location.href = 'agency-setup.html'; return; }

    document.getElementById('agencyName').textContent = user.agency_name;
    document.getElementById('agencyPoints').textContent = user.points;
    document.getElementById('agencyReferralCode').textContent = user.referral_code;

    const tbody = document.getElementById('agencyListingsBody');
    if (tbody) acWireMyListings(tbody, user.id, function (list) {
      document.getElementById('agencyListingCount').textContent = list.length;
    });

    const referrals = await AcDB.getDirectReferrals();
    document.getElementById('agencyReferralCount').textContent = referrals.length;

    document.getElementById('agencyNameEdit').value = user.agency_name || '';
    document.getElementById('agencyDescriptionEdit').value = user.agency_description || '';
    const preview = document.getElementById('agencyLogoPreview');
    const previewWrap = document.getElementById('agencyLogoPreviewWrap');
    if (user.agency_logo_path && preview && previewWrap) {
      preview.src = user.agency_logo_path;
      previewWrap.style.display = 'block';
    }

    acWireLogoDrop('agencyLogoEditFile', 'agencyLogoEditDrop');

    const profileForm = document.getElementById('agencyProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const errorEl = document.getElementById('agencyProfileError');
        const successEl = document.getElementById('agencyProfileSuccess');
        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        const agencyName = document.getElementById('agencyNameEdit').value.trim();
        const agencyDescription = document.getElementById('agencyDescriptionEdit').value.trim();
        const logoInput = document.getElementById('agencyLogoEditFile');
        const logoFile = logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;

        const result = await AcDB.updateAgencyProfile(user.id, { agencyName, agencyDescription, logoFile });
        if (result.error) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
          return;
        }
        document.getElementById('agencyName').textContent = agencyName;
        if (result.user && result.user.agency_logo_path) {
          preview.src = result.user.agency_logo_path;
          previewWrap.style.display = 'block';
        }
        successEl.textContent = 'Saved.';
        successEl.style.display = 'block';
      });
    }

    if (typeof acMountReferralCta === 'function') acMountReferralCta(user);
  })();
}
