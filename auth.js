// AgenticCore Estate — authentication (Supabase Auth)
// CNIC/government ID is intentionally NOT collected here — only phone,
// email and password are needed to hold an account. CNIC collection at
// listing time (sell.js) and document upload for developers (developer.js)
// are currently switched off for the launch window; see sell.js/db-client.js.

function showAuthError(el, message) {
  el.textContent = message;
  el.style.display = 'block';
}

function hideAuthError(el) {
  el.style.display = 'none';
  el.classList.remove('ok');
}

function setLoading(btn, loading, defaultText) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : defaultText;
}

// -------- SIGN UP --------

// ---------- return destinations + join intents ----------
// A return destination is a same-site page with an optional simple query and an
// optional dashboard-module hash (my.html#agency). Nothing else is followed.
const AC_NEXT_RE = /^[a-z0-9-]+\.html(\?[A-Za-z0-9=&%_.-]*)?(#[a-z]+)?$/;
function acSafeNext() {
  const n = new URLSearchParams(window.location.search).get('next') || '';
  return AC_NEXT_RE.test(n) ? n : '';
}
// One stable address per participant: signup.html?intent=<key>. The intent only
// preselects the account type and where to go next — it grants nothing
// (project publishing still needs the admin-approved capability).
const AC_JOIN = {
  list: { role: 'buyer', dest: 'sell.html' },
  professional: { role: 'professional', dest: 'my.html#professional' },
  agency: { role: 'agency', dest: 'my.html#agency' },
  builder: { role: 'builder', dest: 'my.html#company' },
  developer: { role: 'developer', dest: 'my.html#projects' }
};
function acJoinIntent() {
  const q = new URLSearchParams(window.location.search).get('intent');
  if (q && Object.prototype.hasOwnProperty.call(AC_JOIN, q)) return q;
  const next = acSafeNext();
  return Object.keys(AC_JOIN).filter(function (k) { return AC_JOIN[k].dest === next; })[0] || null;
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('signupBtn');
    hideAuthError(errorEl);

    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const roleInput = document.querySelector('input[name="role"]:checked');
    const role = roleInput ? roleInput.value : 'buyer';
    const referralCode = document.getElementById('referralCode').value.trim() || new URLSearchParams(window.location.search).get('ref') || '';

    if (password.length < 8) {
      showAuthError(errorEl, 'Password must be at least 8 characters.');
      return;
    }
    if (!/^[0-9+\-\s]{7,}$/.test(phone)) {
      showAuthError(errorEl, 'Enter a valid phone number.');
      return;
    }

    setLoading(btn, true, 'Create account');
    const result = await AcDB.signUp({ fullName, phone, email, password, role, referralCode });
    setLoading(btn, false, 'Create account');

    if (result.error) {
      showAuthError(errorEl, result.error);
      return;
    }
    if (result.needsConfirmation) {
      showAuthError(errorEl, 'Account created — check your email to confirm it, then log in.' +
        (acAmaanDraftWaiting() ? ' Your listing details from Amaan are kept on this device — after you log in, the form opens filled in.' : ''));
      errorEl.style.background = 'rgba(16,185,129,0.1)';
      errorEl.style.color = '#34D399';
      return;
    }

    // Project accounts start the (admin-reviewed) developer application; everyone
    // else lands in the one dashboard, on the module that matches their intent.
    // Project accounts always start the admin-reviewed application.
    const next = acSafeNext() || (acJoinIntent() ? AC_JOIN[acJoinIntent()].dest : '');
    window.location.href = role === 'developer' ? 'developer-apply.html' : next || (acAmaanDraftWaiting() ? AC_AMAAN_FORM : 'my.html?welcome=' + encodeURIComponent(role));
  });
}

// -------- LOG IN --------
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('loginBtn');
    hideAuthError(errorEl);

    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    setLoading(btn, true, 'Log in');
    const result = await AcDB.logIn(identifier, password);
    setLoading(btn, false, 'Log in');

    if (result.error) {
      showAuthError(errorEl, result.error);
      return;
    }

    const user = result.user;
    const next = acSafeNext();
    if (next) { window.location.href = next; return; }
    // e.g. signed up, confirmed by email, now logging in: finish the Amaan listing
    if (user.role !== 'admin' && acAmaanDraftWaiting()) { window.location.href = AC_AMAAN_FORM; return; }
    if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
    else if (user.role === 'developer' && user.developer_status === 'unsubmitted') window.location.href = 'developer-apply.html';   // signup intent: finish the application
    else window.location.href = 'my.html';
  });
}

// Login → "Create one": keep where the person was going (and so what they want to create).
(function () {
  const a = document.getElementById('loginToSignup');
  if (!a) return;
  const next = acSafeNext();
  if (next) a.href = 'signup.html?next=' + encodeURIComponent(next);
  // Sent here from a page that needs an account (e.g. "List a property"):
  // people new to AgenticCore see the sign-up option first, not only in the footer.
  const box = document.getElementById('authNewHere');
  if (box && next) {
    document.getElementById('authNewHereBtn').href = a.href;
    box.hidden = false;
  }
})();

// "Forgot your password? Email me a sign-in link": a one-time link to the
// account's email; it opens the set-password page already signed in. Never
// creates an account, and says the same thing whether or not the email exists.
const mailLinkBtn = document.getElementById('mailLinkBtn');
if (mailLinkBtn) {
  let lastAt = 0;
  mailLinkBtn.addEventListener('click', async function () {
    const errorEl = document.getElementById('authError');
    hideAuthError(errorEl);
    const email = document.getElementById('identifier').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showAuthError(errorEl, acT('auth_maillink_need')); return; }
    if (Date.now() - lastAt < 60000) { showAuthError(errorEl, acT('auth_maillink_wait')); return; }
    lastAt = Date.now();
    mailLinkBtn.disabled = true;
    const { error } = await supabaseClient.auth.signInWithOtp({ email: email, options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/set-password.html' } });
    mailLinkBtn.disabled = false;
    if (error && /rate|seconds|too many/i.test(error.message || '')) { showAuthError(errorEl, acT('auth_maillink_wait')); return; }
    showAuthError(errorEl, acT('auth_maillink_sent'));
    errorEl.classList.add('ok');
  });
}
