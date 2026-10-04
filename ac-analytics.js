// Google Analytics 4 — visitor counts, top pages, where visitors come from.
// Approved by the owner (G-K2MEP4Z12P, agenticcore.estate only). Not loaded on
// local test servers. Click events come from acTrack() in ecosystem.js
// (allow-listed names, never personal data). IP addresses are anonymised.
(function () {
  var ID = 'G-K2MEP4Z12P';
  if (!/(^|\.)agenticcore\.estate$/.test(location.hostname)) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', ID, { anonymize_ip: true });
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
  document.head.appendChild(s);
})();
