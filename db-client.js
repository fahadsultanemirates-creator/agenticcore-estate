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
  // Launch-phase: document verification is switched off, so applications are
  // approved immediately instead of sitting in the admin review queue. The
  // upload paths stay optional in the schema so this can flip back on later.
  async function submitDeveloperApplication(payload) {
    const insertRow = {
      user_id: payload.userId,
      company_name: payload.companyName,
      phone: payload.phone,
      tier: payload.tier,
      status: 'approved',
      decision_at: nowIso()
    };
    if (payload.cnicFile) {
      const cnicExt = (payload.cnicFile.name.split('.').pop() || 'bin').toLowerCase();
      const cnicPath = payload.userId + '/cnic-' + Date.now() + '.' + cnicExt;
      const cnicUpload = await supabaseClient.storage.from('developer-docs').upload(cnicPath, payload.cnicFile);
      if (cnicUpload.error) return { error: cnicUpload.error.message };
      insertRow.cnic_document_path = cnicPath;
    }
    if (payload.companyDocFile) {
      const companyExt = (payload.companyDocFile.name.split('.').pop() || 'bin').toLowerCase();
      const companyPath = payload.userId + '/company-doc-' + Date.now() + '.' + companyExt;
      const companyUpload = await supabaseClient.storage.from('developer-docs').upload(companyPath, payload.companyDocFile);
      if (companyUpload.error) return { error: companyUpload.error.message };
      insertRow.company_document_path = companyPath;
    }
    if (payload.cnic) insertRow.cnic = payload.cnic;

    const { data: app, error } = await supabaseClient.from('developer_applications').insert(insertRow).select().single();
    if (error) return { error: error.message };

    const profileUpdate = { developer_status: 'approved', developer_tier: payload.tier };
    if (payload.cnic) profileUpdate.cnic = payload.cnic;
    await supabaseClient.from('profiles').update(profileUpdate).eq('id', payload.userId);

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
      size_unit: payload.sizeUnit || 'marla',
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
    listing.sizeUnit = listing.size_unit;
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
    let ownersById = {};
    if (ownerIds.length) {
      const { data: owners } = await supabaseClient.from('public_profiles')
        .select('id, developer_tier, role, agency_name, agency_logo_path').in('id', ownerIds);
      (owners || []).forEach(function (o) { ownersById[o.id] = o; });
    }

    listings.forEach(function (l) {
      const owner = ownersById[l.owner_id];
      l.sizeMarla = l.size_marla;
      l.sizeUnit = l.size_unit;
      l.ownerDeveloperTier = owner ? owner.developer_tier : null;
      l.featured = l.ownerDeveloperTier === 3;
      l.agencyName = owner && owner.role === 'agency' ? owner.agency_name : null;
      l.agencyLogo = owner && owner.role === 'agency' ? owner.agency_logo_path : null;
    });

    listings.sort(function (a, b) { return (b.featured ? 1 : 0) - (a.featured ? 1 : 0); });
    return listings;
  }

  async function getListing(id) {
    const { data, error } = await supabaseClient.from('listings').select('*').eq('id', id).single();
    if (error || !data) return null;
    data.sizeMarla = data.size_marla;
    data.sizeUnit = data.size_unit;
    const owner = await getUser(data.owner_id);
    if (owner && owner.role === 'agency') {
      data.agencyName = owner.agency_name;
      data.agencyLogo = owner.agency_logo_path;
    }
    return data;
  }

  async function getListingsByOwner(ownerId) {
    const { data } = await supabaseClient.from('listings').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    (data || []).forEach(function (l) { l.sizeMarla = l.size_marla; l.sizeUnit = l.size_unit; });
    return data || [];
  }

  // ---------- referrals (direct only -- 10% flat, no levels) ----------
  async function getDirectReferrals() {
    const { data } = await supabaseClient.rpc('get_my_direct_referrals');
    return (data || []).map(function (row) {
      return { id: row.id, fullName: row.full_name, joinedAt: row.joined_at };
    });
  }

  async function joinReferralProgram(userId) {
    return updateUser(userId, { referral_joined: true, referral_joined_at: nowIso() });
  }

  // ---------- promotional logo uploads (agency / builder) ----------
  async function uploadProfileAsset(userId, file, prefix) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = userId + '/' + prefix + '-' + Date.now() + '.' + ext;
    const uploadResult = await supabaseClient.storage.from('profile-assets').upload(path, file);
    if (uploadResult.error) return { error: uploadResult.error.message };
    const { data: pub } = supabaseClient.storage.from('profile-assets').getPublicUrl(path);
    return { path: pub.publicUrl };
  }

  // ---------- agency profile ----------
  async function updateAgencyProfile(userId, payload) {
    const patch = {
      agency_name: payload.agencyName,
      agency_description: payload.agencyDescription || null
    };
    if (payload.logoFile) {
      const uploaded = await uploadProfileAsset(userId, payload.logoFile, 'agency-logo');
      if (uploaded.error) return { error: uploaded.error };
      patch.agency_logo_path = uploaded.path;
    }
    const updated = await updateUser(userId, patch);
    if (!updated) return { error: 'Could not save agency profile.' };
    return { user: updated };
  }

  // ---------- builder / developer company profile ----------
  async function updateBuilderProfile(userId, payload) {
    const patch = {
      builder_company_name: payload.companyName,
      builder_description: payload.description || null,
      builder_projects_completed: payload.projectsCompleted || 0,
      builder_services: payload.services || null
    };
    if (payload.logoFile) {
      const uploaded = await uploadProfileAsset(userId, payload.logoFile, 'builder-logo');
      if (uploaded.error) return { error: uploaded.error };
      patch.builder_logo_path = uploaded.path;
    }
    const updated = await updateUser(userId, patch);
    if (!updated) return { error: 'Could not save company profile.' };
    return { user: updated };
  }

  // ---------- projects (whole-project / society listings) ----------
  async function addProject(payload) {
    const { data: project, error } = await supabaseClient.from('projects').insert({
      owner_id: payload.ownerId,
      title: payload.title,
      city: payload.city,
      area: payload.area,
      status: payload.status || 'off_plan',
      unit_types: payload.unitTypes || [],
      total_units: payload.totalUnits || null,
      total_plots: payload.totalPlots || null,
      size_from: payload.sizeFrom || null,
      size_to: payload.sizeTo || null,
      size_unit: payload.sizeUnit || 'sqft',
      price_from: payload.priceFrom || null,
      price_to: payload.priceTo || null,
      payment_plan: payload.paymentPlan || null,
      possession_date: payload.possessionDate || null,
      description: payload.description || null
    }).select().single();
    if (error) return { error: error.message };

    if (payload.photoFiles && payload.photoFiles.length) {
      const urls = [];
      for (let i = 0; i < payload.photoFiles.length; i++) {
        const file = payload.photoFiles[i];
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = payload.ownerId + '/' + project.id + '/photo-' + i + '.' + ext;
        const uploadResult = await supabaseClient.storage.from('project-assets').upload(path, file);
        if (!uploadResult.error) {
          const { data: pub } = supabaseClient.storage.from('project-assets').getPublicUrl(path);
          urls.push(pub.publicUrl);
        }
      }
      if (urls.length) {
        await supabaseClient.from('projects').update({ photos: urls }).eq('id', project.id);
        project.photos = urls;
      }
    }

    if (payload.brochureFile) {
      const ext = (payload.brochureFile.name.split('.').pop() || 'pdf').toLowerCase();
      const path = payload.ownerId + '/' + project.id + '/brochure.' + ext;
      const uploadResult = await supabaseClient.storage.from('project-assets').upload(path, payload.brochureFile, { upsert: true });
      if (!uploadResult.error) {
        const { data: pub } = supabaseClient.storage.from('project-assets').getPublicUrl(path);
        await supabaseClient.from('projects').update({ brochure_path: pub.publicUrl }).eq('id', project.id);
        project.brochure_path = pub.publicUrl;
      }
    }

    return { project: project };
  }

  async function getProjects(filters) {
    filters = filters || {};
    let q = supabaseClient.from('projects').select('*').order('created_at', { ascending: false });
    if (filters.city) q = q.eq('city', filters.city);
    if (filters.status) q = q.eq('status', filters.status);
    const { data } = await q;
    return data || [];
  }

  async function getProject(id) {
    const { data } = await supabaseClient.from('projects').select('*').eq('id', id).single();
    return data || null;
  }

  async function getProjectsByOwner(ownerId) {
    const { data } = await supabaseClient.from('projects').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    return data || [];
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
    getDirectReferrals: getDirectReferrals, joinReferralProgram: joinReferralProgram,
    updateAgencyProfile: updateAgencyProfile, updateBuilderProfile: updateBuilderProfile,
    addProject: addProject, getProjects: getProjects, getProject: getProject, getProjectsByOwner: getProjectsByOwner
  };
})();

async function requireAuth(roles) {
  const user = await AcDB.currentUser();
  if (!user) { window.location.href = 'login.html'; return null; }
  if (roles && roles.indexOf(user.role) === -1) { window.location.href = 'index.html'; return null; }
  return user;
}
