// AgenticCore Estate — referral dashboard (direct only, flat 10%)

const DIRECT_REFERRAL_PCT = 10;

const refRoot = document.getElementById('refRoot');
if (refRoot) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller', 'developer', 'agency', 'builder']);
    if (!user) return;

    const joinGate = document.getElementById('refJoinGate');
    const content = document.getElementById('refContent');

    if (!user.referral_joined) {
      joinGate.style.display = 'block';
      content.style.display = 'none';
      document.getElementById('refJoinCopy').textContent =
        'Activate your referral link and start sharing it today. Whenever someone you referred spends on AgenticCore, you earn ' + DIRECT_REFERRAL_PCT + '% of it as AgenticCore Points — usable across every AgenticCore site.';
      const joinBtn = document.getElementById('refJoinBtn');
      joinBtn.addEventListener('click', async function () {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining…';
        const updated = await AcDB.joinReferralProgram(user.id);
        if (updated) {
          user.referral_joined = true;
          joinGate.style.display = 'none';
          content.style.display = 'block';
          renderDashboard();
        } else {
          joinBtn.disabled = false;
          joinBtn.textContent = 'Join the referral program';
        }
      });
      return;
    }

    content.style.display = 'block';
    renderDashboard();

    async function renderDashboard() {
      const origin = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
      document.getElementById('refLink').value = origin + 'signup.html?ref=' + user.referral_code;
      document.getElementById('refCode').textContent = user.referral_code;
      document.getElementById('refPoints').textContent = user.points;

      const copyBtn = document.getElementById('refCopyBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', function () {
          const input = document.getElementById('refLink');
          input.select();
          navigator.clipboard && navigator.clipboard.writeText(input.value);
          copyBtn.textContent = 'Copied!';
          setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 1500);
        });
      }

      const referrals = await AcDB.getDirectReferrals();
      document.getElementById('refTotalPeople').textContent = referrals.length;

      const body = document.getElementById('refDirectBody');
      body.innerHTML = referrals.map(function (r) {
        return '<tr><td>' + acEscHTML(r.fullName) + '</td><td>' + new Date(r.joinedAt).toLocaleDateString() + '</td></tr>';
      }).join('') || '<tr><td colspan="2" style="color:var(--text-tertiary);">No referrals yet — share your link above to start earning.</td></tr>';
    }
  })();
}
