/* ============================================
   AgenticCore Estate — Listing Quality score (0–100)
   Deterministic and explainable: every point comes from a named factor
   with a fix-it tip. No AI decides the number. Loaded by the browser
   (window.AcListingQuality) and by the Netlify service (module.exports).
   A higher score means a more complete listing — it does not guarantee
   enquiries or a sale.
   ============================================ */
(function (root) {
  var BUILT_TYPES = ['house', 'flat', 'upper_portion', 'lower_portion', 'room', 'farm_house'];
  var DETAIL_WORDS = [
    ['possession', /possession|ready to move|transfer/i, 'possession / transfer status'],
    ['parking', /parking|garage|car porch/i, 'parking'],
    ['utilities', /\bgas\b|electricity|water|sui gas|meter/i, 'gas, electricity and water'],
    ['orientation', /corner|facing|park|boulevard|main road/i, 'corner / facing / road'],
    ['nearby', /near|close to|walking distance|minutes? from|school|hospital|market|mosque|masjid/i, 'nearby landmarks (schools, markets, mosque)']
  ];

  function lower(s) { return String(s == null ? '' : s); }

  function score(l, opts) {
    opts = opts || {};
    var f = [];
    function add(key, label, points, max, tip) { f.push({ key: key, label: label, points: Math.max(0, Math.min(points, max)), max: max, tip: points >= max ? null : tip }); }

    var photos = (l.photos || []).length;
    add('photos', 'Photos (' + photos + ')', photos >= 6 ? 25 : photos >= 4 ? 18 : photos >= 2 ? 12 : photos === 1 ? 6 : 0, 25,
      photos === 0 ? 'Add photos — listings without photos get far fewer clicks. Start with the front elevation.'
        : 'Add ' + (6 - photos) + ' more photo' + (6 - photos > 1 ? 's' : '') + ': front elevation, drawing room, kitchen, bedrooms, washrooms, street view.');

    var title = lower(l.title).trim();
    var tPts = 0;
    if (title.length >= 20 && title.length <= 90) tPts += 5; else if (title.length >= 10) tPts += 2;
    if (/\d/.test(title) && /(marla|kanal|sq|bed|house|flat|plot|shop|office|portion|apartment)/i.test(title)) tPts += 3;
    if (l.area && title.toLowerCase().indexOf(String(l.area).toLowerCase().split(/[\s-]/)[0]) >= 0) tPts += 2;
    add('title', 'Title', tPts, 10, 'Use a clear title with size, type and location, e.g. "10 Marla House for Sale in DHA Phase 2".');

    var desc = lower(l.description);
    var dLen = desc.trim().length;
    add('description', 'Description length', dLen > 500 ? 15 : dLen > 200 ? 11 : dLen > 80 ? 6 : dLen > 0 ? 2 : 0, 15,
      'Write a fuller description (200+ characters): layout, condition, construction year, what is nearby.');
    var missingDetails = DETAIL_WORDS.filter(function (d) { return !d[1].test(desc); });
    add('details', 'Key details mentioned', DETAIL_WORDS.length - missingDetails.length, 5,
      'Mention ' + missingDetails.map(function (d) { return d[2]; }).slice(0, 3).join(', ') + '.');

    add('price', 'Price given', Number(l.price) > 0 ? 5 : 0, 5, 'Add the demand price — buyers skip listings without one.');

    var area = lower(l.area);
    var specific = /phase|block|sector|street|lane|[a-i]-\d|\d/i.test(area) || area.length > 14;
    add('location', 'Location detail', area ? (specific ? 10 : 5) : 0, 10, 'Be specific about the location: phase, block or sector (e.g. "Bahria Town Phase 8, Abu Bakar Block").');

    var aPts = Number(l.size_marla) > 0 ? 5 : 0;
    var needsRooms = BUILT_TYPES.indexOf(l.property_type) >= 0;
    var roomTip = [];
    if (!aPts) roomTip.push('size');
    if (needsRooms) {
      if (Number(l.beds) > 0) aPts += 5; else roomTip.push('bedrooms');
      if (Number(l.baths) > 0) aPts += 5; else roomTip.push('bathrooms');
    } else { aPts += 10; }
    add('attributes', 'Size and rooms', aPts, 15, 'Add ' + roomTip.join(', ') + '.');

    add('verified', 'Checked by AgenticCore', l.verified ? 5 : 0, 5, 'Ask AgenticCore to check the listing details (this is an information check, not a title or legal verification).');

    var fresh = l.last_confirmed_at || l.updated_at || l.created_at;
    var days = fresh ? (Date.now() - new Date(fresh).getTime()) / 86400000 : 999;
    add('fresh', 'Recently confirmed available', days <= 30 ? 5 : 0, 5, 'Confirm the property is still available — buyers trust fresh listings.');

    if (typeof opts.profileComplete === 'boolean') {
      add('profile', 'Seller profile', opts.profileComplete ? 5 : 0, 5, 'Complete your profile (agency name and logo) so buyers know who they are dealing with.');
    }

    var got = 0, max = 0;
    f.forEach(function (x) { got += x.points; max += x.max; });
    var s = Math.round(100 * got / max);
    var tips = f.filter(function (x) { return x.tip; }).sort(function (a, b) { return (b.max - b.points) - (a.max - a.points); }).map(function (x) { return x.tip; });
    return { score: s, band: s >= 80 ? 'Strong' : s >= 50 ? 'Good' : 'Needs work', factors: f, tips: tips };
  }

  var api = { score: score };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AcListingQuality = api;
})(typeof window !== 'undefined' ? window : globalThis);
