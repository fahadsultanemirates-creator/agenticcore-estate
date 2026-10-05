/* ============================================
   AgenticCore Estate — real data layer (Supabase)
   ------------------------------------------------
   Replaces mock-db.js. Same AcDB.* function names as the old
   localStorage mock (that was the point of the mock's design),
   but every call is now async since it's a real network-backed
   database — every caller must await it.
   ============================================ */

// Escape database text before it goes into innerHTML (same rule as listings.js acEsc,
// available on every page because db-client.js is loaded everywhere).
function acEscHTML(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// Upload rules — mirror the storage bucket limits set in migration 0017, so a
// rejected file gets a clear message instead of silently disappearing.
// Most photos one property listing can have (website, account page and Telegram).
const AC_MAX_PHOTOS = 15;

const AC_UPLOAD_RULES = {
  photo: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxMB: 10, label: 'JPG, PNG, WebP or GIF image' },
  logo: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxMB: 5, label: 'JPG, PNG, WebP or GIF image' },
  brochure: { types: ['application/pdf'], maxMB: 20, label: 'PDF' },
  projectPhoto: { types: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'], maxMB: 20, label: 'JPG, PNG, WebP or GIF image' },
  document: { types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxMB: 10, label: 'JPG, PNG, WebP image or PDF' }
};
function acCheckUploads(files, kind) {
  const rule = AC_UPLOAD_RULES[kind];
  for (const f of (files || [])) {
    if (!f) continue;
    if (rule.types.indexOf(f.type) === -1) return '"' + f.name + '" is not a ' + rule.label + '.';
    if (f.size > rule.maxMB * 1024 * 1024) return '"' + f.name + '" is larger than ' + rule.maxMB + ' MB.';
  }
  return null;
}

// Card thumbnails: a 640px-wide WebP made in the browser from each uploaded photo,
// so marketplace cards never download a full-size original. Falls back to the
// photo itself when the browser can't decode it (the upload rules still apply).
async function acMakeThumb(file, maxW) {
  try {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return null;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, (maxW || 640) / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(function (res) { canvas.toBlob(res, 'image/webp', 0.8); });
    return blob && blob.type === 'image/webp' ? blob : null;
  } catch (e) { return null; }
}

// Upload one photo (+ its thumbnail) to a public bucket; returns { url, thumb } or null.
async function acUploadPhoto(bucket, basePath, file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const up = await supabaseClient.storage.from(bucket).upload(basePath + '.' + ext, file);
  if (up.error) return null;
  const url = supabaseClient.storage.from(bucket).getPublicUrl(basePath + '.' + ext).data.publicUrl;
  let thumb = url;
  const t = await acMakeThumb(file, 640);
  if (t) {
    const tu = await supabaseClient.storage.from(bucket).upload(basePath + '-thumb.webp', t, { contentType: 'image/webp' });
    if (!tu.error) thumb = supabaseClient.storage.from(bucket).getPublicUrl(basePath + '-thumb.webp').data.publicUrl;
  }
  return { url: url, thumb: thumb };
}

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
    // No public phone lookup any more: a duplicate phone is rejected by the
    // unique phone constraint when the signup trigger creates the profile.
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
      if (/database error saving new user/i.test(error.message)) return { error: 'An account with this phone number may already exist. Try logging in instead.' };
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
      // The server returns the account email only if this password is correct.
      const { data: resolvedEmail, error: lookupError } = await supabaseClient.rpc('login_email_for_phone', { p_phone: identifier, p_password: password });
      if (lookupError && /too many/i.test(lookupError.message)) return { error: lookupError.message };
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
  // Property listings use the main cities; projects may also use the
  // projects-only places (Murree, Galiyat, Gilgit-Baltistan, … — migration 0028).
  async function getActiveCityRows(forProjects) {
    const { data } = await supabaseClient.from('cities').select('*').eq('active', true).order('sort_order');
    return (data || []).filter(function (c) { return forProjects || c.projects_only !== true; });
  }
  async function getActiveCities(forProjects) {
    return (await getActiveCityRows(forProjects)).map(function (c) { return c.name; });
  }

  async function getAreasForCity(cityName) {
    const { data } = await supabaseClient.from('areas').select('name').eq('city_name', cityName).order('sort_order');
    const names = (data || []).map(function (a) { return a.name; });
    // plus the built-in list for the city (ac-cities.js), so every known area is offered
    const have = names.map(function (n) { return n.toLowerCase(); });
    (typeof acCityAreas === 'function' ? acCityAreas(cityName) : []).forEach(function (a) { if (have.indexOf(a.toLowerCase()) < 0) { names.push(a); have.push(a.toLowerCase()); } });
    // every other area of the city with live listings, A–Z (shown as its own group)
    names.more = (typeof acCityMoreAreas === 'function' ? acCityMoreAreas(cityName) : []).filter(function (a) { return have.indexOf(a.toLowerCase()) < 0; });
    return names;
  }

  // ---------- developer applications ----------
  // Developer application. It is created as 'pending'; the database moves the
  // account to developer_status = 'pending', and only an admin can approve it
  // and grant the package tier (admin_decide_developer_application).
  async function submitDeveloperApplication(payload) {
    const docError = acCheckUploads([payload.cnicFile, payload.companyDocFile], 'document');
    if (docError) return { error: docError };
    const insertRow = {
      user_id: payload.userId,
      company_name: payload.companyName,
      phone: payload.phone,
      tier: payload.tier
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
    if (payload.cnic) await supabaseClient.from('profiles').update({ cnic: payload.cnic }).eq('id', payload.userId);
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

  // Admin decision: one server function updates the application, the profile
  // (status + tier) and admin_log together.
  async function decideApplication(appId, decision, adminId, note) {
    const { data, error } = await supabaseClient.rpc('admin_decide_developer_application', {
      p_application: appId, p_decision: decision, p_note: note || ''
    });
    if (error || !data) return null;
    return data;
  }

  // ---------- listings ----------
  async function addListing(payload) {
    const photoError = acCheckUploads(payload.photoFiles, 'photo');
    if (photoError) return { error: photoError };
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
      description: payload.description,
      // optional marketplace links (the database checks each one belongs to this account)
      agency_id: payload.agencyId || null,
      professional_id: payload.professionalId || null,
      project_id: payload.projectId || null
    }).select().single();
    if (error) return { error: error.message };

    if (payload.photoFiles && payload.photoFiles.length) {
      const urls = [], thumbs = [];
      for (let i = 0; i < payload.photoFiles.length; i++) {
        const up = await acUploadPhoto('listing-photos', payload.ownerId + '/' + listing.id + '/' + i, payload.photoFiles[i]);
        if (up) { urls.push(up.url); thumbs.push(up.thumb); }
      }
      if (urls.length) {
        await supabaseClient.from('listings').update({ photos: urls, thumbs: thumbs }).eq('id', listing.id);
        listing.photos = urls; listing.thumbs = thumbs;
      }
    }
    listing.sizeMarla = listing.size_marla;
    listing.sizeUnit = listing.size_unit;
    return { listing };
  }

  async function getListings(filters) {
    filters = filters || {};
    // Genuine listings only (samples are rendered by market-ui.js with a SAMPLE badge).
    let q = supabaseClient.from('listings').select('*,agency:agencies(id,name,logo_url)')
      .eq('is_sample', false).eq('moderation_status', 'active').order('created_at', { ascending: false }).limit(filters.limit || 200);
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

    listings.forEach(function (l) {
      l.sizeMarla = l.size_marla;
      l.sizeUnit = l.size_unit;
      l.agencyName = l.agency ? l.agency.name : null;
      l.agencyLogo = l.agency ? l.agency.logo_url : null;
    });
    return listings;
  }

  async function getListing(id) {
    const { data, error } = await supabaseClient.from('listings')
      .select('*,agency:agencies(id,name,logo_url),professional:professionals(id,display_name,avatar_url),project:projects(id,title)')
      .eq('id', id).single();
    if (error || !data) return null;
    data.sizeMarla = data.size_marla;
    data.sizeUnit = data.size_unit;
    if (data.agency) { data.agencyName = data.agency.name; data.agencyLogo = data.agency.logo_url; }
    return data;
  }

  // Edit an existing listing (RLS lets only the owner or an admin update it).
  // New photos are appended to the existing ones, up to AC_MAX_PHOTOS in total.
  async function updateListing(id, ownerId, payload) {
    const photoError = acCheckUploads(payload.photoFiles, 'photo');
    if (photoError) return { error: photoError };
    const patch = {
      title: payload.title, type: payload.type, property_type: payload.propertyType,
      city: payload.city, area: payload.area, price: payload.price,
      beds: payload.beds || 0, baths: payload.baths || 0,
      size_marla: payload.sizeMarla || 0, size_unit: payload.sizeUnit || 'marla',
      description: payload.description,
      agency_id: payload.agencyId || null, professional_id: payload.professionalId || null, project_id: payload.projectId || null
    };
    const { data: listing, error } = await supabaseClient.from('listings').update(patch).eq('id', id).select().single();
    if (error || !listing) return { error: error ? error.message : 'Could not save this listing.' };

    const existing = listing.photos || [];
    // older listings have no thumbnails: reuse the photo itself for those slots
    const existingThumbs = existing.map(function (u, i) { return (listing.thumbs || [])[i] || u; });
    const files = (payload.photoFiles || []).slice(0, Math.max(0, AC_MAX_PHOTOS - existing.length));
    if (files.length) {
      const urls = existing.slice(), thumbs = existingThumbs.slice();
      for (let i = 0; i < files.length; i++) {
        const up = await acUploadPhoto('listing-photos', ownerId + '/' + id + '/' + Date.now() + '-' + i, files[i]);
        if (up) { urls.push(up.url); thumbs.push(up.thumb); }
      }
      await supabaseClient.from('listings').update({ photos: urls, thumbs: thumbs }).eq('id', id);
      listing.photos = urls; listing.thumbs = thumbs;
    }
    return { listing: listing };
  }

  // Delete a listing and its photos. The select() after delete tells us
  // whether a row was really removed (RLS turns a refused delete into 0 rows).
  async function deleteListing(id, ownerId) {
    const { data: rows, error } = await supabaseClient.from('listings').delete().eq('id', id).select('id, photos');
    if (error) return { error: error.message };
    if (!rows || !rows.length) return { error: 'This listing could not be deleted. Please contact support.' };
    const prefix = supabaseClient.storage.from('listing-photos').getPublicUrl('').data.publicUrl;
    const paths = (rows[0].photos || []).map(function (u) { return u.indexOf(prefix) === 0 ? decodeURIComponent(u.slice(prefix.length)) : null; }).filter(Boolean);
    if (paths.length) await supabaseClient.storage.from('listing-photos').remove(paths);
    return {};
  }

  // Seller's name + phone for a listing, for signed-in visitors only
  // (security-definer RPC, so profiles.phone never becomes publicly readable).
  async function getListingContact(listingId) {
    const { data, error } = await supabaseClient.rpc('get_listing_contact', { p_listing: listingId });
    if (error) return { error: error.message };
    return { contact: (data || [])[0] || null };
  }

  // Master accounts (migration 0026) list for owners who have no account:
  // each listing can carry that owner's number. Kept in entity_public_phones,
  // so it is shown only to signed-in visitors, like every other number.
  async function isMaster() {
    const { data, error } = await supabaseClient.rpc('is_master');
    return !error && data === true;
  }
  async function getListingPhone(listingId) {
    const { data } = await supabaseClient.from('entity_public_phones').select('phone').eq('entity_type', 'listing').eq('entity_id', listingId).maybeSingle();
    return (data && data.phone) || '';
  }
  async function setListingPhone(listingId, phone) {
    const { error } = await supabaseClient.rpc('set_listing_contact_phone', { p_listing: listingId, p_phone: phone || null });
    return { error: error ? error.message : null };
  }

  async function getListingsByOwner(ownerId) {
    const { data } = await supabaseClient.from('listings').select('*').eq('owner_id', ownerId).order('created_at', { ascending: false });
    (data || []).forEach(function (l) { l.sizeMarla = l.size_marla; l.sizeUnit = l.size_unit; });
    // a master account's per-listing contact numbers (own rows only, by RLS)
    if ((data || []).length) {
      const { data: ph } = await supabaseClient.from('entity_public_phones').select('entity_id, phone').eq('entity_type', 'listing').eq('owner_id', ownerId);
      const byId = {};
      (ph || []).forEach(function (r) { byId[r.entity_id] = r.phone; });
      data.forEach(function (l) { l.contact_phone = byId[l.id] || ''; });
    }
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
    const logoError = acCheckUploads([file], 'logo');
    if (logoError) return { error: logoError };
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
  function projectRow(payload) {
    return {
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
      description: payload.description || null,
      project_type: payload.projectType || null,
      approvals_info: payload.approvalsInfo || null,
      company_id: payload.companyId || null
    };
  }

  async function uploadProjectFiles(ownerId, project, payload, existingPhotos, existingThumbs) {
    const patch = {};
    if (payload.photoFiles && payload.photoFiles.length) {
      const urls = (existingPhotos || []).slice(), thumbs = (existingThumbs || []).slice();
      const room = Math.max(0, 8 - urls.length);
      for (let i = 0; i < Math.min(room, payload.photoFiles.length); i++) {
        const up = await acUploadPhoto('project-assets', ownerId + '/' + project.id + '/photo-' + Date.now() + '-' + i, payload.photoFiles[i]);
        if (up) { urls.push(up.url); thumbs.push(up.thumb); }
      }
      patch.photos = urls; patch.thumbs = thumbs;
    }
    if (payload.brochureFile) {
      const path = ownerId + '/' + project.id + '/brochure.pdf';
      const uploadResult = await supabaseClient.storage.from('project-assets').upload(path, payload.brochureFile, { upsert: true });
      if (!uploadResult.error) patch.brochure_path = supabaseClient.storage.from('project-assets').getPublicUrl(path).data.publicUrl;
    }
    if (Object.keys(patch).length) {
      await supabaseClient.from('projects').update(patch).eq('id', project.id);
      Object.assign(project, patch);
    }
  }

  async function addProject(payload) {
    const fileError = acCheckUploads(payload.photoFiles, 'projectPhoto') || acCheckUploads([payload.brochureFile], 'brochure');
    if (fileError) return { error: fileError };
    const row = projectRow(payload); row.owner_id = payload.ownerId;
    const { data: project, error } = await supabaseClient.from('projects').insert(row).select().single();
    if (error) return { error: error.message };
    await uploadProjectFiles(payload.ownerId, project, payload, [], []);
    return { project: project };
  }

  async function updateProject(id, payload) {
    const fileError = acCheckUploads(payload.photoFiles, 'projectPhoto') || acCheckUploads([payload.brochureFile], 'brochure');
    if (fileError) return { error: fileError };
    const { data: project, error } = await supabaseClient.from('projects').update(projectRow(payload)).eq('id', id).select().single();
    if (error || !project) return { error: error ? error.message : 'Could not save this project.' };
    const photos = project.photos || [];
    await uploadProjectFiles(payload.ownerId, project, payload, photos, photos.map(function (u, i) { return (project.thumbs || [])[i] || u; }));
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
    getActiveCities: getActiveCities, getActiveCityRows: getActiveCityRows, getAreasForCity: getAreasForCity,
    submitDeveloperApplication: submitDeveloperApplication, listApplications: listApplications,
    getApplication: getApplication, getApplicationForUser: getApplicationForUser,
    getSignedDocUrl: getSignedDocUrl, decideApplication: decideApplication,
    addListing: addListing, getListings: getListings, getListing: getListing, getListingsByOwner: getListingsByOwner,
    updateListing: updateListing, deleteListing: deleteListing, getListingContact: getListingContact,
    isMaster: isMaster, getListingPhone: getListingPhone, setListingPhone: setListingPhone,
    getDirectReferrals: getDirectReferrals, joinReferralProgram: joinReferralProgram,
    updateAgencyProfile: updateAgencyProfile, updateBuilderProfile: updateBuilderProfile,
    addProject: addProject, updateProject: updateProject, getProjects: getProjects, getProject: getProject, getProjectsByOwner: getProjectsByOwner
  };
})();

// The caller's project-publisher capability: none / pending / approved / rejected / revoked.
// Any account may apply; only an admin approves (account_capabilities, 0018).
async function acCapabilityStatus() {
  const { data, error } = await supabaseClient.rpc('my_capability_status', { p_cap: 'project_publisher' });
  return error ? 'none' : (data || 'none');
}

// Amaan's listing notes wait in this browser (ac_amaan_listing, 2 hours, never in
// a URL) until the owner reaches the listing form. This only peeks; sell.js uses
// and deletes them. Lets log-in / sign-up / the header send the owner back there.
const AC_AMAAN_FORM = 'sell.html?assist=1&amaan=1';
function acAmaanDraftWaiting() {
  try {
    const s = JSON.parse(localStorage.getItem('ac_amaan_listing') || 'null');
    return !!(s && Array.isArray(s.notes) && s.notes.length && Date.now() - Number(s.at || 0) < 2 * 3600 * 1000);
  } catch (e) { return false; }
}

async function requireAuth(roles) {
  const user = await AcDB.currentUser();
  if (!user) {
    // keep a dashboard module (#agency, #professional…) so sign-in returns to it
    const here = location.pathname.split('/').pop() + location.search + (/^#[a-z]+$/.test(location.hash) ? location.hash : '');
    window.location.href = 'login.html' + (here ? '?next=' + encodeURIComponent(here) : '');
    return null;
  }
  if (roles && roles.indexOf(user.role) === -1) { window.location.href = 'index.html'; return null; }
  return user;
}

// <option>s for an area dropdown: the popular areas, then "All areas A–Z".
// <option>s for a city select: the main cities first, then (projects only)
// the other places grouped by province.
function acPlaceOptionsHTML(rows) {
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function label(n) { return typeof acCityLabel === 'function' && typeof acUiLang === 'function' ? acCityLabel(n, acUiLang()) : n; }
  const main = rows.filter(function (c) { return c.projects_only !== true; });
  const more = rows.filter(function (c) { return c.projects_only === true; });
  let html = main.map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(label(c.name)) + '</option>'; }).join('');
  const regions = [];
  more.forEach(function (c) { const r = c.region || 'Other'; if (regions.indexOf(r) < 0) regions.push(r); });
  regions.forEach(function (r) {
    html += '<optgroup label="' + esc(r + ' — projects') + '">' + more.filter(function (c) { return (c.region || 'Other') === r; })
      .map(function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + '</option>'; }).join('') + '</optgroup>';
  });
  return html;
}

function acAreaOptions(areas, selected) {
  function esc(v) { return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function opt(a) { return '<option value="' + esc(a) + '"' + (a === selected ? ' selected' : '') + '>' + esc(a) + '</option>'; }
  var html = areas.map(opt).join('');
  if (areas.more && areas.more.length) {
    var label = (typeof acT === 'function' && acT('city_area_all') && acT('city_area_all') !== 'city_area_all') ? acT('city_area_all') : 'All areas A–Z';
    // a visible divider too: some phones and browsers hide optgroup labels
    html += '<option value="" disabled>── ' + esc(label) + ' ──</option>';
    html += '<optgroup label="' + esc(label) + '">' + areas.more.map(opt).join('') + '</optgroup>';
  }
  return html;
}
