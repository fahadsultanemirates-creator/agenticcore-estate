// AgenticCore Estate — authentication (Supabase Auth)
// CNIC/government ID is intentionally NOT collected here — only phone,
// email and password are needed to hold an account. Individual sellers
// are asked for CNIC the first time they post a listing (sell.js), and
// developers/agencies provide it with supporting documents at the
// verification step (developer.js) — matching how Zameen/Graana only
// ask for ID at the point identity actually matters, not at signup.

function showAuthError(el, message) {
  el.textContent = message;
  el.style.display = 'block';
}

function hideAuthError(el) {
  el.style.display = 'none';
}

function setLoading(btn, loading, defaultText) {
  btn.disabled = loading;
  btn.textContent = loading ? 'Please wait…' : defaultText;
}

// -------- SIGN UP --------
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
      showAuthError(errorEl, 'Account created — check your email to confirm it, then log in.');
      errorEl.style.background = 'rgba(16,185,129,0.1)';
      errorEl.style.color = '#34D399';
      return;
    }

    if (role === 'developer') {
      window.location.href = 'developer-apply.html';
    } else {
      window.location.href = 'dashboard.html';
    }
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
    if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
    else if (user.role === 'developer') {
      if (user.developer_status === 'unsubmitted') window.location.href = 'developer-apply.html';
      else if (user.developer_status === 'pending') window.location.href = 'developer-pending.html';
      else window.location.href = 'developer-dashboard.html';
    } else window.location.href = 'dashboard.html';
  });
}
