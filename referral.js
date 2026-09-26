// AgenticCore Estate — referral dashboard (opt-in, 10 levels deep)

const REFERRAL_PCT = [25, 15, 10, 5, 2.5];
const DEMO_TASK_VALUE = 500000; // sample transaction used for illustrative point math
const MAX_TREE_RENDER_DEPTH = 3;
const MAX_TREE_CHILDREN_SHOWN = 8;

function acBuildReferralTree(rootUser, levels) {
  const nodesById = {};
  nodesById[rootUser.id] = { id: rootUser.id, name: rootUser.full_name, children: [] };
  levels.forEach(function (levelUsers) {
    levelUsers.forEach(function (u) { nodesById[u.id] = { id: u.id, name: u.fullName, children: [] }; });
  });
  levels.forEach(function (levelUsers) {
    levelUsers.forEach(function (u) {
      const parent = nodesById[u.referredBy];
      if (parent) parent.children.push(nodesById[u.id]);
    });
  });
  return nodesById[rootUser.id];
}

function acCountDescendants(node) {
  return node.children.reduce(function (sum, c) { return sum + 1 + acCountDescendants(c); }, 0);
}

function acRenderTreeNode(node, depth) {
  const label = '<a>' + node.name + '</a>';
  if (!node.children.length) return '<li>' + label + '</li>';
  if (depth >= MAX_TREE_RENDER_DEPTH) {
    const total = acCountDescendants(node);
    return '<li>' + label + '<ul><li><a style="opacity:0.6;">+' + total + ' more in team</a></li></ul></li>';
  }
  const shown = node.children.slice(0, MAX_TREE_CHILDREN_SHOWN);
  const extra = node.children.length - shown.length;
  let childrenHTML = shown.map(function (c) { return acRenderTreeNode(c, depth + 1); }).join('');
  if (extra > 0) childrenHTML += '<li><a style="opacity:0.6;">+' + extra + ' more</a></li>';
  return '<li>' + label + '<ul>' + childrenHTML + '</ul></li>';
}

function acReferralTreeHTML(root) {
  if (!root.children.length) {
    return '<p style="color:var(--text-tertiary);font-size:0.85rem;">No referrals yet — share your link below to start building your team.</p>';
  }
  return '<ul class="ref-tree">' + acRenderTreeNode(root, 0) + '</ul>';
}

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
        'Activate your referral link and start building your team today. Earn AgenticCore Points — and real rewards — up to 10 levels deep. Packages aren\'t announced yet, but your link and team already work.';
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

    const membershipGrid = document.getElementById('refMembershipGrid');
    if (membershipGrid) membershipGrid.innerHTML = acReferralMembershipGridHTML();

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

    const tree = await AcDB.getReferralTree(user.id, 10);
    let totalPeople = 0;

    const payoutBody = document.getElementById('refLevelsBody');
    payoutBody.innerHTML = tree.slice(0, 5).map(function (levelUsers, i) {
      const estPoints = Math.round(levelUsers.length * DEMO_TASK_VALUE * (REFERRAL_PCT[i] / 100));
      return (
        '<tr><td><span class="level-badge" style="width:32px;height:32px;font-size:0.75rem;display:inline-flex;">L' + (i + 1) + '</span></td>' +
        '<td>' + REFERRAL_PCT[i] + '%</td>' +
        '<td>' + levelUsers.length + '</td>' +
        '<td>' + (levelUsers.map(function (u) { return u.fullName; }).join(', ') || '—') + '</td>' +
        '<td>' + acFormatPKR(estPoints) + '</td></tr>'
      );
    }).join('');

    const teamBody = document.getElementById('refTeamBody');
    teamBody.innerHTML = tree.map(function (levelUsers, i) {
      totalPeople += levelUsers.length;
      return (
        '<tr><td><span class="level-badge" style="width:32px;height:32px;font-size:0.75rem;display:inline-flex;">L' + (i + 1) + '</span></td>' +
        '<td>' + levelUsers.length + '</td>' +
        '<td>' + (levelUsers.map(function (u) { return u.fullName; }).join(', ') || '—') + '</td></tr>'
      );
    }).join('');

    document.getElementById('refTotalPeople').textContent = totalPeople;

    const treeViz = document.getElementById('refTreeViz');
    if (treeViz) treeViz.innerHTML = acReferralTreeHTML(acBuildReferralTree(user, tree));
    }
  })();
}
