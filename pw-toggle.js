/* Show/hide (eye) button on every password box. Self-contained: works on
   any page that includes it, in English and Urdu (RTL) layouts. */
(function () {
  var css = '.pw-wrap{position:relative;display:block}.pw-wrap input{padding-inline-end:2.8rem!important;width:100%}' +
    '.pw-eye{position:absolute;inset-inline-end:.35rem;top:50%;transform:translateY(-50%);background:none;border:0;padding:.35rem;cursor:pointer;color:inherit;opacity:.7;line-height:0}' +
    '.pw-eye:hover,.pw-eye:focus-visible{opacity:1}.pw-eye svg{width:20px;height:20px}';
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-7 0-11-7-11-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>';
  function ur() { return (document.documentElement.getAttribute('lang') || '').indexOf('ur') === 0; }
  function label(shown) { return ur() ? (shown ? 'پاس ورڈ چھپائیں' : 'پاس ورڈ دکھائیں') : (shown ? 'Hide password' : 'Show password'); }
  function add(input) {
    if (input.dataset.pwEye) return;
    input.dataset.pwEye = '1';
    var wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'pw-eye';
    function paint() { var shown = input.type === 'text'; b.innerHTML = shown ? EYE_OFF : EYE; b.setAttribute('aria-label', label(shown)); b.setAttribute('aria-pressed', shown ? 'true' : 'false'); b.title = label(shown); }
    b.addEventListener('click', function () { input.type = input.type === 'password' ? 'text' : 'password'; paint(); input.focus(); });
    // hide again before the form is sent, so browsers still offer to save it as a password
    if (input.form) input.form.addEventListener('submit', function () { input.type = 'password'; paint(); });
    paint();
    wrap.appendChild(b);
  }
  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    document.querySelectorAll('input[type="password"]').forEach(add);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
