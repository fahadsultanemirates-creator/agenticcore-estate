// AgenticCore Estate — shared "join the referral program" panel
// Used on every account-type dashboard (standard/agency/project/builder).
// Joining is a deliberate opt-in (profiles.referral_joined) rather than
// automatic just from having an account, per the launch plan: packages
// aren't finalized yet, but the referral link + team-building already work.

function acMountReferralCta(user) {
  const copyEl = document.getElementById('referralJoinCopy');
  const joinBtn = document.getElementById('referralJoinBtn');
  const openBtn = document.getElementById('referralOpenBtn');
  if (!copyEl || !joinBtn || !openBtn) return;

  function renderJoined() {
    copyEl.textContent = 'You\'re in. Share your referral link — whenever someone you referred spends on AgenticCore, you earn 10% of it as AgenticCore Points.';
    joinBtn.style.display = 'none';
    openBtn.style.display = 'inline-block';
  }

  function renderNotJoined() {
    copyEl.textContent = 'Activate your referral link and start sharing it today. Earn 10% of what the people you refer spend, as AgenticCore Points — usable across every AgenticCore site.';
    joinBtn.style.display = 'inline-block';
    openBtn.style.display = 'none';
  }

  if (user.referral_joined) {
    renderJoined();
  } else {
    renderNotJoined();
    joinBtn.addEventListener('click', async function () {
      joinBtn.disabled = true;
      joinBtn.textContent = 'Joining…';
      const updated = await AcDB.joinReferralProgram(user.id);
      if (updated) {
        user.referral_joined = true;
        renderJoined();
      } else {
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join the referral program';
      }
    });
  }
}
