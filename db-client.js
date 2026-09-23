/* ============================================
   AgenticCore Estate — real data layer (Supabase)
   ------------------------------------------------
   Replaces mock-db.js. Same AcDB.* function names as the old
   localStorage mock (that was the point of the mock's design),
   but every call is now async since it's a real network-backed
   database — every caller must await it.
   ============================================ */

const AcDB = (function () {
  function nowIso() { return new Date().toISOString(); }

  async function currentUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
    if (error || !data) return null;
    data.email = session.user.email;
    data.sizeMarla = undefined;
    return data;
  }

  async function signUp(payload) {
    const { data: existingEmail } = await supabaseClient.rpc('email_for_phone', { phone_input: payload.phone });
    if (existingEmail) return { error: 'An account with this phone number already exists.' };

    const { data, error } = await supabaseClient.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          phone: payload.phone,
          role: payload.role || 'buyer',
          referral_code: payload.referralCode || ''
        }
      }
    });

    if (error) {
      if (/registered|exists/i.test(error.message)) return { error: 'An account with this email already exists.' };
      return { error: error.message };
    }

    if (!data.session) {
      return { needsConfirmation: true };
    }

    const user = await currentUser();
    return { user };
  }

  async function logIn(identifier, password) {
    let email = identifier;
    if (identifier.indexOf('@') === -1) {
      const { data: resolvedEmail } = await supabaseClient.rpc('email_for_phone', { phone_input: identifier });
      if (!resolvedEmail) return { error: 'Incorrect phone/email or password.' };
      email = resolvedEmail;
    }
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return { error: 'Incorrect phone/email or password.' };
    const user = await currentUser();
    if (!user) return { error: 'Could not load your account — please try again.' };
    return { user };
  }

  async function logOut() {
    await supabaseClient.auth.signOut();
  }

  async function updateUser(userId, patch) {
    const { data, error } = await supabaseClient.from('profiles').update(patch).eq('id', userId).select().single();
    if (error) return null;
    return data;
  }

  async function getUser(id) {
    const { data } = await supabaseClient.from('public_profiles').select('*').eq('id', id).single();
    return data || null;
  }

  async function listUsers() {
    const { data } = await supabaseClient.from('profiles').select('*');
    return data || [];
  }

  // ---------- reference data ----------
  async function getActiveCities() {
    const { data } = await supabaseClient.from('cities').select('name').eq('active', true).order('sort_order');
    return (data || []).map(function (c) { return c.name; });
  }

  async function getAreasForCity(cityName) {
    const { data } = await supabaseClient.from('areas').select('name').eq('city_name', cityName).order('sort_order');
    return (data || []).map(function (a) { return a.name; });
  }

  // ---------- developer applications ----------
  async function submitDeveloperApplication(payload) {
    const cnicExt = (payload.cnicFile.name.split('.').pop() || 'bin').toLowerCase();
    const companyExt = (payload.companyDocFile.name.split('.').pop() || 'bin').toLowerCase();
    const cnicPath = payload.userId + '/cnic-' + Date.now() + '.' + cnicExt;
    const companyPath = payload.userId + '/company-doc-' + Date.now() + '.' + companyExt;

    const [cnicUpload, companyUpload] = await Promise.all([
      supabaseClient.storage.from('developer-docs').upload(cnicPath, payload.cnicFile),
      supabaseClient.storage.from('developer-docs').upload(companyPath, payload.companyDocFile)
    ]);
    if (cnicUpload.error || companyUpload.error) {
      return { error: (cnicUpload.error || companyUpload.error).message };
    }

    const { data: app, error } = await supabaseClient.from('developer_applications').insert({
      user_id: payload.userId,
      company_name: payload.companyName,
      phone: payload.phone,
      cnic: payload.cnic,
      cnic_document_path: cnicPath,
      company_document_path: companyPath,
      tier: payload.tier
    }).select().single();
    if (error) return { error: error.message };

    await supabaseClient.from('profiles')
      .update({ developer_status: 'pending', developer_tier: payload.tier, cnic: payload.cnic })
      .eq('id', payload.userId);

    return { application: app };
  }

  async function listApplications(status) {
    let q = supabaseClient.from('developer_applications').select('*').order('submitted_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data } = await q;
    return data || [];
  }

  async function getApplication(id) {
    const { data } = await supabaseClient.from('developer_applications').select('*').eq('id', id).single();
    return data || null;
  }

  async function getApplicationForUser(userId) {
    const { data } = await supabaseClient.from('developer_applications')
      .select('*').eq('user_id', userId).order('submitted_at', { ascending: false }).limit(1).maybeSingle();
    return data || null;
  }

  async function getSignedDocUrl(path) {
    const { data } = await supabaseClient.storage.from('developer-docs').createSignedUrl(path, 3600);
    return data ? data.signedUrl : null;
  }

  async function decideApplication(appId, decision, adminId, note) {
    const { data, error } = await supabaseClient.from('developer_applications')
      .update({ status: decision, decision_at: nowIso(), reviewer_id: adminId, reviewer_note: note || '' })
      .eq('id', appId).select().single();
    if (error || !data) return null;

    await supabaseClient.from('profiles').update({ developer_status: decision }).eq('id', data.user_id);
    await supabaseClient.from('admin_log').insert({
      admin_id: adminId, action: decision, target_table: 'developer_applications', target_id: appId, note: note || ''
    });
    return data;
  }

  // ---------- listings ----------
  async function addListing(payload) {
    const { data: listing, error } = await supabaseClient.from('listings').insert({
      owner_id: payload.ownerId,
      title: payload.title,
      type: payload.type,
      property_type: payload.propertyType,
      city: payload.city,
      area: payload.area,
      price: payload.price,
      beds: payload.beds || 0,
      baths: payload.baths || 0,
      size_marla: payload.sizeMarla || 0,
      description: payload.description
    }).select().single();
    if (error) return { error: error.message };

    if (payload.photoFiles && payload.photoFiles.length) {
      const urls = [];
      for (let i = 0; i < payload.photoFiles.length; i++) {
        const file = payload.photoFiles[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = payload.ownerId + '/' + listing.id + '/' + i + '.' + ext;
        const uploadResult = await supabaseClient.storage.from('listing-photos').upload(path, file);
        if (!uploadResult.error) {
          const { data: pub } = supabaseClient.storage.from('listing-photos').getPublicUrl(path);
          urls.push(pub.publicUrl);
        }
      }
      if (urls.length) {
        await supabaseClient.from('listings').update({ photos: urls }).eq('id', listing.id);
        listing.photos = urls;
      }
    }
    listing.sizeMarla = listing.size_marla;
    return { listing };
  }

  async function getListings(filters) {
    filters = filters || {};
    let q = supabaseClient.from('listings').select('*').order('created_at', { ascending: false });
    if (filters.type) q = q.eq('type', filters.type);
    if (filters.city) q = q.eq('city', filters.city);
    if (filters.propertyType) q = q.eq('property_type', filters.propertyType);
    if (filters.minPrice) q = q.gte('price', Number(filters.minPrice));
    if (filters.maxPrice) q = q.lte('price', Number(filters.maxPrice));
    if (filters.beds) q = q.gte('beds', Number(filters.beds));
    if (filters.q) {
      const safeQ = filters.q.replace(/[,()%]/g, ' ').trim();
      if (safeQ) q = q.or('title.ilike.%' + safeQ + '%,area.ilike.%' + safeQ + '%,city.ilike.%' + safeQ + '%');
    }

    const { data: listings, error } = await q;
    if (error || !listings) return [];

    const ownerIds = Array.from(new Set(listings.map(function (l) { return l.owner_id; })));
    let tierByOwner = {};
    if (ownerIds.length) {
      const { data: owners } = await supabaseClient.from('public_profiles').select('id, developer_tier').in('id', ownerIds);
      (owners || []).forEach(function (o) { tierByOwner[o.id] = o.developer_tier; });
    }

    listings.forEach(function (l) {
      l.sizeMarla = l.size_marla;
      l.ownerDeveloperTier = tierByOwner[l.owner_id] || null;
      l.featured = l.ownerDeveloperTier === 3;
    });

    listings.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return listings;
  }

  async function getListing(id) {
    const { data, error } = await supabaseClient.from('listings').select('*').eq('id', id).single();
    if (error || !data) return null;
    data.sizeMarla = data.size_marla;
    return data;
  }

  async function getListingsByOwner(ownerId) {
    const { data } = await supabaseClient.from('listings').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    (data || []).forEach(function (l) { l.sizeMarla = l.size_marla; });
    return data || [];
  }

  // ---------- referrals (5 levels deep, computed server-side) ----------
  async function getReferralTree(userId) {
    const { data } = await supabaseClient.rpc('get_referral_tree', { root_id: userId, max_depth: 5 });
    const levels = [[], [], [], [], []];
    (data || []).forEach(function (row) {
      if (row.level >= 1 && row.level <= 5) levels[row.level - 1].push({ id: row.id, fullName: row.full_name });
    });
    return levels;
  }

  return {
    currentUser: currentUser,
    signUp: signUp, logIn: logIn, logOut: logOut, updateUser: updateUser,
    getUser: getUser, listUsers: listUsers,
    getActiveCities: getActiveCities, getAreasForCity: getAreasForCity,
    submitDeveloperApplication: submitDeveloperApplication, listApplications: listApplications,
    getApplication: getApplication, getApplicationForUser: getApplicationForUser,
    getSignedDocUrl: getSignedDocUrl, decideApplication: decideApplication,
    addListing: addListing, getListings: getListings, getListing: getListing, getListingsByOwner: getListingsByOwner,
    getReferralTree: getReferralTree
  };
})();

async function requireAuth(roles) {
  const user = await AcDB.currentUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  if (roles && roles.indexOf(user.role) === -1) { window.location.href = 'index.html'; return null; }
  return user;
}
