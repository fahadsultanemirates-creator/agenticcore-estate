/* International phone numbers on sign-up and login (shared by
   agenticcore.estate and agenticcorepk.com).
   - Sign-up (#phone): a country-code picker in front of the number; Pakistan
     first, then the countries where most overseas Pakistanis live. The number
     is sent as "+<code> <number>" (a leading 0 is dropped); the server stores
     one standard form (ac_norm_phone), so login works however it is typed.
   - Login (#identifier): a short hint for numbers from abroad. */
(function () {
  var CC = [
    ['+92', 'Pakistan', '3XX XXXXXXX'], ['+971', 'UAE', '5X XXX XXXX'], ['+966', 'Saudi Arabia', '5X XXX XXXX'],
    ['+974', 'Qatar', 'XXXX XXXX'], ['+968', 'Oman', 'XXXX XXXX'], ['+965', 'Kuwait', 'XXXX XXXX'], ['+973', 'Bahrain', 'XXXX XXXX'],
    ['+44', 'United Kingdom', '7XXX XXXXXX'], ['+1', 'USA / Canada', 'XXX XXX XXXX'], ['+61', 'Australia', '4XX XXX XXX'],
    ['+64', 'New Zealand', '2X XXX XXXX'], ['+353', 'Ireland', '8X XXX XXXX'], ['+49', 'Germany', '15X XXXXXXXX'],
    ['+39', 'Italy', '3XX XXX XXXX'], ['+34', 'Spain', '6XX XXX XXX'], ['+33', 'France', '6 XX XX XX XX'],
    ['+31', 'Netherlands', '6 XXXXXXXX'], ['+47', 'Norway', '4XX XX XXX'], ['+46', 'Sweden', '7X XXX XX XX'],
    ['+45', 'Denmark', 'XX XX XX XX'], ['+32', 'Belgium', '4XX XX XX XX'], ['+41', 'Switzerland', '7X XXX XX XX'],
    ['+43', 'Austria', '6XX XXXXXXX'], ['+30', 'Greece', '69X XXX XXXX'], ['+90', 'Turkey', '5XX XXX XXXX'],
    ['+60', 'Malaysia', '1X XXX XXXX'], ['+65', 'Singapore', 'XXXX XXXX'], ['+86', 'China', '1XX XXXX XXXX'],
    ['+81', 'Japan', '90 XXXX XXXX'], ['+82', 'South Korea', '10 XXXX XXXX'], ['+27', 'South Africa', '7X XXX XXXX'],
    ['+254', 'Kenya', '7XX XXXXXX'], ['+20', 'Egypt', '1X XXXX XXXX'], ['+98', 'Iran', '9XX XXX XXXX'],
    ['+93', 'Afghanistan', '7X XXX XXXX'], ['+880', 'Bangladesh', '1XXX XXXXXX'], ['+91', 'India', 'XXXXX XXXXX'],
    ['', 'Other — type +code', '+XX XXX XXX XXXX']
  ];
  function ur() { return (document.documentElement.getAttribute('lang') || '').indexOf('ur') === 0; }
  function css() {
    if (document.getElementById('ac-phone-css')) return;
    var st = document.createElement('style'); st.id = 'ac-phone-css';
    st.textContent = '.ac-phone{display:flex;gap:.4rem;align-items:stretch}.ac-phone select{flex:0 0 auto;max-width:42%;width:auto}' +
      '.ac-phone input{flex:1 1 auto;min-width:0}.ac-phone-hint{display:block;font-size:.8rem;opacity:.75;margin-top:.3rem}';
    document.head.appendChild(st);
  }
  // "+971" + "050 123 4567" → "+971 50 123 4567"; a number already starting with + or 00 is kept
  function combine(code, local) {
    var v = String(local || '').trim();
    if (!v || /^(\+|00)/.test(v) || !code) return v;
    return code + ' ' + v.replace(/^0+/, '');
  }
  function signup(input) {
    if (input.dataset.acPhone) return;
    input.dataset.acPhone = '1';
    css();
    var sel = document.createElement('select');
    sel.setAttribute('aria-label', ur() ? 'ملک کا کوڈ' : 'Country code');
    sel.innerHTML = CC.map(function (c, i) { return '<option value="' + c[0] + '"' + (i === 0 ? ' selected' : '') + '>' + (c[0] ? c[0] + ' ' : '') + c[1] + '</option>'; }).join('');
    var wrap = document.createElement('div'); wrap.className = 'ac-phone';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(sel); wrap.appendChild(input);
    function ph() { var c = CC[sel.selectedIndex]; input.placeholder = c[2]; }
    sel.addEventListener('change', ph); ph();
    var hint = document.createElement('small'); hint.className = 'ac-phone-hint';
    hint.textContent = ur() ? 'بیرونِ ملک رہتے ہیں؟ اپنا ملک چنیں اور نمبر لکھیں۔' : 'Living abroad? Pick your country, then type your number.';
    wrap.insertAdjacentElement('afterend', hint);
    // runs before the page's own submit handler, which reads #phone
    document.addEventListener('submit', function (e) {
      if (input.form && e.target === input.form) input.value = combine(sel.value, input.value);
    }, true);
  }
  function login(input) {
    if (input.dataset.acPhone) return;
    input.dataset.acPhone = '1';
    css();
    var hint = document.createElement('small'); hint.className = 'ac-phone-hint';
    hint.textContent = ur() ? 'پاکستانی نمبر 0300… یا ‎+92… دونوں طرح۔ بیرونِ ملک نمبر ملک کے کوڈ کے ساتھ لکھیں، مثلاً ‎+971 50 123 4567'
      : 'Pakistani numbers as 0300… or +92…; numbers from abroad with the country code, e.g. +971 50 123 4567.';
    input.insertAdjacentElement('afterend', hint);
  }
  function init() {
    var p = document.getElementById('phone');
    if (p && p.type === 'tel' && document.getElementById('password')) signup(p);
    var id = document.getElementById('identifier');
    if (id && document.getElementById('loginForm')) login(id);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
