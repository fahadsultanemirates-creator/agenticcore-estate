// AgenticCore Estate — authentication (against local mock-db)

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
  signupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('signupBtn');
    hideAuthError(errorEl);

    const fullName = document.getElementById('fullName').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const cnic = document.getElementById('cnic').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.querySelector('input[name="role"]:checked') ? document.querySelector('input[name="role"]:checked').value : 'buyer';
    const referralCode = document.getElementById('referralCode').value.trim() || new URLSearchParams(window.location.search).get('ref') || '';

    if (password.length < 8) {
      showAuthError(errorEl, 'Password must be at least 8 characters.');
      return;
    }
    if (!/^[0-9+\-\s]{7,}$/.test(phone)) {
      showAuthError(errorEl, 'Enter a valid phone number.');
      return;
    }
    if (cnic.replace(/\D/g, '').length < 13) {
      showAuthError(errorEl, 'Enter a valid 13-digit government ID / CNIC number.');
      return;
    }

    setLoading(btn, true, 'Create account');

    const result = AcDB.signUp({ fullName, phone, cnic, email, password, role, referralCode });

    setLoading(btn, false, 'Create account');

    if (result.error) {
      showAuthError(errorEl, result.error);
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
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('authError');
    const btn = document.getElementById('loginBtn');
    hideAuthError(errorEl);

    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    setLoading(btn, true, 'Log in');
    const result = AcDB.logIn(identifier, password);
    setLoading(btn, false, 'Log in');

    if (result.error) {
      showAuthError(errorEl, result.error);
      return;
    }

    const user = result.user;
    if (user.role === 'admin') window.location.href = 'admin-dashboard.html';
    else if (user.role === 'developer') {
      if (user.developerStatus === 'unsubmitted') window.location.href = 'developer-apply.html';
      else if (user.developerStatus === 'pending') window.location.href = 'developer-pending.html';
      else window.location.href = 'developer-dashboard.html';
    } else window.location.href = 'dashboard.html';
  });
}

function requireAuth(roles) {
  const user = AcDB.currentUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  if (roles && roles.indexOf(user.role) === -1) { window.location.href = 'index.html'; return null; }
  return user;
}
