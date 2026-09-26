// AgenticCore Estate — builder/developer promotion-only company profile

function acWireBuilderLogoDrop(inputId, dropId) {
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
const builderSetupForm = document.getElementById('builderSetupForm');
if (builderSetupForm) {
  (async function () {
    const user = await requireAuth(['builder']);
    if (!user) return;
    if (user.builder_company_name) { window.location.href = 'builder-dashboard.html'; return; }

    acWireBuilderLogoDrop('builderLogoFile', 'builderLogoDrop');

    builderSetupForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const errorEl = document.getElementById('authError');
      const submitBtn = builderSetupForm.querySelector('button[type="submit"]');
      errorEl.style.display = 'none';

      const companyName = document.getElementById('builderCompanyName').value.trim();
      const description = document.getElementById('builderDescription').value.trim();
      const projectsCompleted = Number(document.getElementById('builderProjectsCompleted').value) || 0;
      const services = document.getElementById('builderServices').value.trim();
      const logoInput = document.getElementById('builderLogoFile');
      const logoFile = logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Setting up…';

      const result = await AcDB.updateBuilderProfile(user.id, { companyName, description, projectsCompleted, services, logoFile });

      if (result.error) {
        errorEl.textContent = result.error;
        errorEl.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create company dashboard';
        return;
      }

      window.location.href = 'builder-dashboard.html';
    });
  })();
}

// -------- dashboard --------
const builderDashRoot = document.getElementById('builderDashRoot');
if (builderDashRoot) {
  (async function () {
    const user = await requireAuth(['builder']);
    if (!user) return;
    if (!user.builder_company_name) { window.location.href = 'builder-setup.html'; return; }

    document.getElementById('builderName').textContent = user.builder_company_name;
    document.getElementById('builderProjectsCount').textContent = user.builder_projects_completed || 0;
    document.getElementById('builderPoints').textContent = user.points;
    document.getElementById('builderReferralCode').textContent = user.referral_code;

    const tree = await AcDB.getReferralTree(user.id);
    document.getElementById('builderReferralCount').textContent = tree.reduce(function (sum, l) { return sum + l.length; }, 0);

    document.getElementById('builderCompanyNameEdit').value = user.builder_company_name || '';
    document.getElementById('builderDescriptionEdit').value = user.builder_description || '';
    document.getElementById('builderProjectsCompletedEdit').value = user.builder_projects_completed || 0;
    document.getElementById('builderServicesEdit').value = user.builder_services || '';
    const preview = document.getElementById('builderLogoPreview');
    const previewWrap = document.getElementById('builderLogoPreviewWrap');
    if (user.builder_logo_path && preview && previewWrap) {
      preview.src = user.builder_logo_path;
      previewWrap.style.display = 'block';
    }

    acWireBuilderLogoDrop('builderLogoEditFile', 'builderLogoEditDrop');

    const profileForm = document.getElementById('builderProfileForm');
    if (profileForm) {
      profileForm.addEventListener('submit', async function (e) {
        e.preventDefault();
        const errorEl = document.getElementById('builderProfileError');
        const successEl = document.getElementById('builderProfileSuccess');
        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        const companyName = document.getElementById('builderCompanyNameEdit').value.trim();
        const description = document.getElementById('builderDescriptionEdit').value.trim();
        const projectsCompleted = Number(document.getElementById('builderProjectsCompletedEdit').value) || 0;
        const services = document.getElementById('builderServicesEdit').value.trim();
        const logoInput = document.getElementById('builderLogoEditFile');
        const logoFile = logoInput.files && logoInput.files[0] ? logoInput.files[0] : null;

        const result = await AcDB.updateBuilderProfile(user.id, { companyName, description, projectsCompleted, services, logoFile });
        if (result.error) {
          errorEl.textContent = result.error;
          errorEl.style.display = 'block';
          return;
        }
        document.getElementById('builderName').textContent = companyName;
        document.getElementById('builderProjectsCount').textContent = projectsCompleted;
        if (result.user && result.user.builder_logo_path) {
          preview.src = result.user.builder_logo_path;
          previewWrap.style.display = 'block';
        }
        successEl.textContent = 'Saved.';
        successEl.style.display = 'block';
      });
    }

    if (typeof acMountReferralCta === 'function') acMountReferralCta(user);
  })();
}
