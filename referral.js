// AgenticCore Estate — 5-level referral dashboard

const REFERRAL_PCT = [10, 5, 3, 2, 1];
const DEMO_TASK_VALUE = 500000; // sample transaction used for illustrative point math

const refRoot = document.getElementById('refRoot');
if (refRoot) {
  (async function () {
    const user = await requireAuth(['buyer', 'seller', 'developer']);
    if (!user) return;

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

    const tree = await AcDB.getReferralTree(user.id);
    let totalPeople = 0;
    const body = document.getElementById('refLevelsBody');
    body.innerHTML = tree.map(function (levelUsers, i) {
      totalPeople += levelUsers.length;
      const estPoints = Math.round(levelUsers.length * DEMO_TASK_VALUE * (REFERRAL_PCT[i] / 100));
      return (
        '<tr><td><span class="level-badge" style="width:32px;height:32px;font-size:0.75rem;display:inline-flex;">L' + (i + 1) + '</span></td>' +
        '<td>' + REFERRAL_PCT[i] + '%</td>' +
        '<td>' + levelUsers.length + '</td>' +
        '<td>' + (levelUsers.map(function (u) { return u.fullName; }).join(', ') || '—') + '</td>' +
        '<td>' + acFormatPKR(estPoints) + '</td></tr>'
      );
    }).join('');

    document.getElementById('refTotalPeople').textContent = totalPeople;
  })();
}
