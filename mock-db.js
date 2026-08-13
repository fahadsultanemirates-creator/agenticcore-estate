/* ============================================
   AgenticCore Estate — local data layer
   ------------------------------------------------
   This is a browser-only, localStorage-backed mock
   of the eventual Supabase backend (see
   /supabase/migrations/0001_init_estate_schema.sql
   for the intended real schema). It exists so every
   flow in this scaffold — signup, developer document
   review, admin approval, referrals, listings — is
   actually clickable end to end without a live
   database being provisioned yet.

   DEMO ONLY: passwords are stored in plain text in
   localStorage. Never do this against a real backend
   — swap this file for calls to supabase-client.js
   + Supabase Auth + RLS-protected tables when the
   real project is wired up.
   ============================================ */

const AC_DB_KEY = 'acEstateDB_v1';
const AC_SESSION_KEY = 'acEstateSession_v1';

const AcDB = (function () {
  function _read() {
    const raw = localStorage.getItem(AC_DB_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function _write(db) {
    localStorage.setItem(AC_DB_KEY, JSON.stringify(db));
  }

  function genId(prefix) {
    return prefix + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function genReferralCode(name) {
    const base = (name || 'user').replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase() || 'USER';
    return base + Math.floor(1000 + Math.random() * 9000);
  }

  function nowIso() { return new Date().toISOString(); }

  function seed() {
    const db = {
      users: [],
      developerApplications: [],
      listings: [],
      adminLog: []
    };

    const admin = {
      id: genId('u'), fullName: 'AgenticCore Admin', phone: '+92 300 1112233', cnic: '35202-0000000-1',
      email: 'admin@agenticcore.estate', password: 'admin123', role: 'admin', referredBy: null,
      referralCode: 'ACADMIN', points: 0, developerStatus: null, developerTier: null,
      developerApplicationId: null, createdAt: nowIso()
    };

    const dev1 = {
      id: genId('u'), fullName: 'Bilal Developments', phone: '+92 321 5551010', cnic: '35201-1234567-3',
      email: 'bilal@builder.pk', password: 'password', role: 'developer', referredBy: null,
      referralCode: 'BILAL410', points: 1250, developerStatus: 'approved', developerTier: 3,
      developerApplicationId: null, createdAt: nowIso()
    };

    const dev2 = {
      id: genId('u'), fullName: 'Noor Estate Builders', phone: '+92 333 4448899', cnic: '42101-7654321-9',
      email: 'noor@builder.pk', password: 'password', role: 'developer', referredBy: null,
      referralCode: 'NOOR221', points: 0, developerStatus: 'pending', developerTier: 2,
      developerApplicationId: null, createdAt: nowIso()
    };

    const buyer1 = {
      id: genId('u'), fullName: 'Ayesha Khan', phone: '+92 300 7778899', cnic: '35202-9988776-5',
      email: 'ayesha@example.com', password: 'password', role: 'buyer', referredBy: null,
      referralCode: 'AYESHA88', points: 340, developerStatus: null, developerTier: null,
      developerApplicationId: null, createdAt: nowIso()
    };

    const buyer2 = {
      id: genId('u'), fullName: 'Usman Tariq', phone: '+92 301 2223344', cnic: '35202-1122334-7',
      email: 'usman@example.com', password: 'password', role: 'buyer', referredBy: buyer1.id,
      referralCode: 'USMAN55', points: 120, developerStatus: null, developerTier: null,
      developerApplicationId: null, createdAt: nowIso()
    };

    const buyer3 = {
      id: genId('u'), fullName: 'Hina Malik', phone: '+92 302 3334455', cnic: '35202-4433221-2',
      email: 'hina@example.com', password: 'password', role: 'buyer', referredBy: buyer2.id,
      referralCode: 'HINA309', points: 40, developerStatus: null, developerTier: null,
      developerApplicationId: null, createdAt: nowIso()
    };

    db.users.push(admin, dev1, dev2, buyer1, buyer2, buyer3);

    const pendingAppSubmitted = new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString();
    const pendingApp = {
      id: genId('app'), userId: dev2.id, companyName: 'Noor Estate Builders',
      phone: dev2.phone, cnic: dev2.cnic, cnicFileName: 'noor-cnic-front.pdf',
      companyDocFileName: 'noor-registration-certificate.pdf',
      tier: 2, status: 'pending', submittedAt: pendingAppSubmitted,
      dueBy: new Date(new Date(pendingAppSubmitted).getTime() + 72 * 3600 * 1000).toISOString(),
      decisionAt: null, reviewerNote: ''
    };
    db.developerApplications.push(pendingApp);
    dev2.developerApplicationId = pendingApp.id;

    const approvedAppSubmitted = new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString();
    const approvedApp = {
      id: genId('app'), userId: dev1.id, companyName: 'Bilal Developments',
      phone: dev1.phone, cnic: dev1.cnic, cnicFileName: 'bilal-cnic-front.pdf',
      companyDocFileName: 'bilal-registration-certificate.pdf',
      tier: 3, status: 'approved', submittedAt: approvedAppSubmitted,
      dueBy: new Date(new Date(approvedAppSubmitted).getTime() + 72 * 3600 * 1000).toISOString(),
      decisionAt: new Date(new Date(approvedAppSubmitted).getTime() + 30 * 3600 * 1000).toISOString(),
      reviewerNote: 'CNIC and registration certificate verified.'
    };
    db.developerApplications.push(approvedApp);
    dev1.developerApplicationId = approvedApp.id;

    const sampleListings = [
      { title: 'Bahria Enclave 10-Marla Villa', type: 'buy', city: 'Islamabad', area: 'Bahria Enclave', price: 42500000, beds: 4, baths: 5, sizeMarla: 10, ownerId: dev1.id, verified: true, description: 'Brand-new corner villa with servant quarter, marble flooring throughout, and a rooftop terrace overlooking the sector green belt.' },
      { title: 'DHA Phase 6 1-Kanal Bungalow', type: 'buy', city: 'Lahore', area: 'DHA Phase 6', price: 68000000, beds: 5, baths: 6, sizeMarla: 20, ownerId: dev1.id, verified: true, description: 'Architect-designed bungalow with basement, home theatre, and a landscaped lawn — ready to move in.' },
      { title: 'Clifton Block 5 Sea-View Apartment', type: 'rent', city: 'Karachi', area: 'Clifton Block 5', price: 185000, beds: 3, baths: 3, sizeMarla: 6, ownerId: dev1.id, verified: true, description: 'Fully furnished high-floor apartment with sea view, backup power, and covered parking for two cars.' },
      { title: 'Gulberg Greens Farmhouse Plot', type: 'buy', city: 'Islamabad', area: 'Gulberg Greens', price: 21000000, beds: 0, baths: 0, sizeMarla: 40, ownerId: buyer1.id, verified: false, description: 'Corner farmhouse plot with possession, on a 60-foot road, walking distance from the main boulevard.' },
      { title: 'Johar Town 5-Marla House', type: 'rent', city: 'Lahore', area: 'Johar Town', price: 95000, beds: 3, baths: 3, sizeMarla: 5, ownerId: dev2.id, verified: false, description: 'Recently renovated double-storey house near Emporium Mall, ideal for a small family.' },
      { title: 'Bahria Town Karachi Precinct 19 Bungalow', type: 'buy', city: 'Karachi', area: 'Precinct 19', price: 31500000, beds: 4, baths: 4, sizeMarla: 8, ownerId: dev1.id, verified: true, description: 'Corner bungalow, grey-structure to finished, with rooftop and driver room.' },
      { title: 'F-11 Markaz Studio Apartment', type: 'rent', city: 'Islamabad', area: 'F-11', price: 65000, beds: 1, baths: 1, sizeMarla: 2, ownerId: buyer2.id, verified: false, description: 'Compact furnished studio near F-11 Markaz, perfect for a single professional.' },
      { title: 'Gulshan-e-Iqbal Block 13 Flat', type: 'buy', city: 'Karachi', area: 'Gulshan-e-Iqbal', price: 18500000, beds: 3, baths: 2, sizeMarla: 4, ownerId: dev2.id, verified: false, description: 'Third-floor flat with lift, in a secure society with a community park.' },
      { title: 'Model Town Extension House', type: 'rent', city: 'Lahore', area: 'Model Town Extension', price: 140000, beds: 4, baths: 4, sizeMarla: 10, ownerId: dev1.id, verified: true, description: 'Spacious double-unit house suitable for a joint family, near Model Town Park.' },
      { title: 'Bani Gala Hillside Plot', type: 'buy', city: 'Islamabad', area: 'Bani Gala', price: 55000000, beds: 0, baths: 0, sizeMarla: 32, ownerId: dev1.id, verified: true, description: 'Elevated lakeside-facing plot with an approved architectural plan included.' },
      { title: 'DHA Phase 8 Furnished Apartment', type: 'rent', city: 'Lahore', area: 'DHA Phase 8', price: 110000, beds: 2, baths: 2, sizeMarla: 5, ownerId: dev2.id, verified: false, description: 'Fully furnished 2-bed apartment in a gated block with 24/7 security and a gym.' },
      { title: 'North Nazimabad Block L House', type: 'buy', city: 'Karachi', area: 'North Nazimabad', price: 24500000, beds: 4, baths: 3, sizeMarla: 6, ownerId: buyer3.id, verified: false, description: 'Well-maintained single-storey house with extra land for a future second floor.' }
    ];

    sampleListings.forEach(function (l) {
      db.listings.push(Object.assign({
        id: genId('l'),
        createdAt: nowIso()
      }, l));
    });

    _write(db);
    return db;
  }

  function getDB() {
    let db = _read();
    if (!db) db = seed();
    return db;
  }

  function saveDB(db) { _write(db); }

  // ---------- session ----------
  function setSession(userId) { localStorage.setItem(AC_SESSION_KEY, userId); }
  function clearSession() { localStorage.removeItem(AC_SESSION_KEY); }
  function currentUser() {
    const id = localStorage.getItem(AC_SESSION_KEY);
    if (!id) return null;
    return getDB().users.find(function (u) { return u.id === id; }) || null;
  }

  // ---------- users ----------
  function findUserByIdentifier(identifier) {
    const id = (identifier || '').trim().toLowerCase();
    return getDB().users.find(function (u) {
      return u.email.toLowerCase() === id || u.phone.replace(/\s+/g, '') === identifier.replace(/\s+/g, '');
    }) || null;
  }

  function signUp(payload) {
    const db = getDB();
    if (db.users.some(function (u) { return u.email.toLowerCase() === payload.email.toLowerCase(); })) {
      return { error: 'An account with this email already exists.' };
    }
    if (db.users.some(function (u) { return u.phone.replace(/\s+/g, '') === payload.phone.replace(/\s+/g, ''); })) {
      return { error: 'An account with this phone number already exists.' };
    }
    let referredBy = null;
    if (payload.referralCode) {
      const ref = db.users.find(function (u) { return u.referralCode === payload.referralCode.toUpperCase(); });
      if (ref) referredBy = ref.id;
    }
    const user = {
      id: genId('u'),
      fullName: payload.fullName,
      phone: payload.phone,
      cnic: payload.cnic,
      email: payload.email,
      password: payload.password,
      role: payload.role || 'buyer',
      referredBy: referredBy,
      referralCode: genReferralCode(payload.fullName),
      points: 0,
      developerStatus: payload.role === 'developer' ? 'unsubmitted' : null,
      developerTier: null,
      developerApplicationId: null,
      createdAt: nowIso()
    };
    db.users.push(user);
    saveDB(db);
    setSession(user.id);
    return { user: user };
  }

  function logIn(identifier, password) {
    const user = findUserByIdentifier(identifier);
    if (!user || user.password !== password) return { error: 'Incorrect phone/email or password.' };
    setSession(user.id);
    return { user: user };
  }

  function logOut() { clearSession(); }

  function updateUser(userId, patch) {
    const db = getDB();
    const user = db.users.find(function (u) { return u.id === userId; });
    if (!user) return null;
    Object.assign(user, patch);
    saveDB(db);
    return user;
  }

  // ---------- developer applications ----------
  function submitDeveloperApplication(payload) {
    const db = getDB();
    const submittedAt = nowIso();
    const app = {
      id: genId('app'),
      userId: payload.userId,
      companyName: payload.companyName,
      phone: payload.phone,
      cnic: payload.cnic,
      cnicFileName: payload.cnicFileName,
      companyDocFileName: payload.companyDocFileName,
      tier: payload.tier,
      status: 'pending',
      submittedAt: submittedAt,
      dueBy: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
      decisionAt: null,
      reviewerNote: ''
    };
    db.developerApplications.push(app);
    const user = db.users.find(function (u) { return u.id === payload.userId; });
    if (user) {
      user.developerStatus = 'pending';
      user.developerApplicationId = app.id;
      user.developerTier = payload.tier;
    }
    saveDB(db);
    return app;
  }

  function listApplications(status) {
    const db = getDB();
    return db.developerApplications
      .filter(function (a) { return !status || a.status === status; })
      .sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
  }

  function getApplication(id) {
    return getDB().developerApplications.find(function (a) { return a.id === id; }) || null;
  }

  function decideApplication(appId, decision, adminId, note) {
    const db = getDB();
    const app = db.developerApplications.find(function (a) { return a.id === appId; });
    if (!app) return null;
    app.status = decision;
    app.decisionAt = nowIso();
    app.reviewerNote = note || '';
    const user = db.users.find(function (u) { return u.id === app.userId; });
    if (user) user.developerStatus = decision;
    db.adminLog.push({ id: genId('log'), adminId: adminId, action: decision, targetId: appId, at: nowIso(), note: note || '' });
    saveDB(db);
    return app;
  }

  // ---------- listings ----------
  function addListing(payload) {
    const db = getDB();
    const listing = Object.assign({ id: genId('l'), createdAt: nowIso(), verified: false }, payload);
    db.listings.push(listing);
    saveDB(db);
    return listing;
  }

  function getListings(filters) {
    filters = filters || {};
    let list = getDB().listings.slice();
    if (filters.type) list = list.filter(function (l) { return l.type === filters.type; });
    if (filters.city) list = list.filter(function (l) { return l.city === filters.city; });
    if (filters.minPrice) list = list.filter(function (l) { return l.price >= Number(filters.minPrice); });
    if (filters.maxPrice) list = list.filter(function (l) { return l.price <= Number(filters.maxPrice); });
    if (filters.beds) list = list.filter(function (l) { return l.beds >= Number(filters.beds); });
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(function (l) {
        return l.title.toLowerCase().indexOf(q) > -1 || l.area.toLowerCase().indexOf(q) > -1 || l.city.toLowerCase().indexOf(q) > -1;
      });
    }
    return list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function getListing(id) {
    return getDB().listings.find(function (l) { return l.id === id; }) || null;
  }

  function getListingsByOwner(ownerId) {
    return getDB().listings.filter(function (l) { return l.ownerId === ownerId; });
  }

  // ---------- referrals (5 levels deep) ----------
  function getDirectReferrals(userId) {
    return getDB().users.filter(function (u) { return u.referredBy === userId; });
  }

  function getReferralTree(userId) {
    const levels = [];
    let frontier = [userId];
    for (let depth = 0; depth < 5; depth++) {
      let nextFrontier = [];
      let levelUsers = [];
      frontier.forEach(function (id) {
        getDirectReferrals(id).forEach(function (u) {
          levelUsers.push(u);
          nextFrontier.push(u.id);
        });
      });
      levels.push(levelUsers);
      frontier = nextFrontier;
      if (frontier.length === 0) break;
    }
    while (levels.length < 5) levels.push([]);
    return levels;
  }

  function getUser(id) {
    return getDB().users.find(function (u) { return u.id === id; }) || null;
  }

  function listUsers() { return getDB().users.slice(); }

  return {
    genId: genId, nowIso: nowIso,
    setSession: setSession, clearSession: clearSession, currentUser: currentUser,
    signUp: signUp, logIn: logIn, logOut: logOut, updateUser: updateUser,
    findUserByIdentifier: findUserByIdentifier, getUser: getUser, listUsers: listUsers,
    submitDeveloperApplication: submitDeveloperApplication, listApplications: listApplications,
    getApplication: getApplication, decideApplication: decideApplication,
    addListing: addListing, getListings: getListings, getListing: getListing, getListingsByOwner: getListingsByOwner,
    getDirectReferrals: getDirectReferrals, getReferralTree: getReferralTree,
    resetDemoData: function () { localStorage.removeItem(AC_DB_KEY); seed(); }
  };
})();
