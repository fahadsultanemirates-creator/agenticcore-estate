/* ============================================
   AgenticCore Estate — "my account" data (Marketplace V2)
   Everything here runs as the signed-in user through RLS and
   column grants: owners can only write their own entities, and
   privileged fields (is_sample, verified, placement, moderation,
   early eligibility) are not writable from the browser at all.
   ============================================ */

const AC_ENTITY_TABLE = { professional: 'professionals', agency: 'agencies', company: 'companies' };

// Columns each profile type may write (mirrors the column grants in 0018).
const AC_ENTITY_COLUMNS = {
  professional: ['display_name', 'avatar_url', 'avatar_kind', 'headline', 'intro', 'why_contact', 'how_i_work', 'years_experience',
    'cities', 'areas_served', 'segments', 'purposes', 'property_types', 'services', 'languages', 'overseas_clients',
    'commission_info', 'special_offer', 'deal_history', 'website_url', 'facebook_url', 'instagram_url', 'youtube_url'],
  agency: ['name', 'logo_url', 'cover_url', 'description', 'office_address', 'city', 'cities', 'areas_served', 'services',
    'segments', 'purposes', 'website_url', 'facebook_url', 'instagram_url', 'youtube_url'],
  company: ['name', 'logo_url', 'cover_url', 'description', 'years_experience', 'cities', 'areas_served', 'services',
    'completed_projects', 'current_projects', 'portfolio', 'payment_terms', 'website_url', 'facebook_url', 'instagram_url', 'youtube_url']
};

const AcMine = (function () {
  async function overview(uid) {
    const q = function (t) { return supabaseClient.from(t).select('*').eq('owner_id', uid).order('created_at', { ascending: true }); };
    const [prof, ag, co, pr, li, early, enq] = await Promise.all([
      q('professionals'), q('agencies'), q('companies'), q('projects'),
      supabaseClient.from('listings').select('id', { count: 'exact', head: true }).eq('owner_id', uid),
      supabaseClient.from('early_participants').select('*').eq('user_id', uid).maybeSingle(),
      supabaseClient.from('enquiries').select('id', { count: 'exact', head: true }).eq('recipient_id', uid).eq('status', 'new')
    ]);
    return {
      professionals: prof.data || [], agencies: ag.data || [], companies: co.data || [], projects: pr.data || [],
      listingCount: li.count || 0, early: early.data || null, newEnquiries: enq.count || 0
    };
  }

  function pick(kind, values) {
    const out = {};
    AC_ENTITY_COLUMNS[kind].forEach(function (k) { if (k in values) out[k] = values[k]; });
    return out;
  }

  async function saveEntity(kind, id, uid, values) {
    const row = pick(kind, values);
    const t = AC_ENTITY_TABLE[kind];
    const res = id
      ? await supabaseClient.from(t).update(row).eq('id', id).select().single()
      : await supabaseClient.from(t).insert(Object.assign({ owner_id: uid }, row)).select().single();
    if (res.error) return { error: res.error.message };
    return { entity: res.data };
  }

  async function deleteEntity(kind, id) {
    const { data, error } = await supabaseClient.from(AC_ENTITY_TABLE[kind]).delete().eq('id', id).select('id');
    if (error) return { error: error.message };
    if (!data || !data.length) return { error: 'Could not delete this profile.' };
    return {};
  }

  // Logos, avatars, covers and portfolio photos: re-encoded to WebP in the
  // browser (max 1200px) before upload; the bucket limits from 0017 still apply.
  async function uploadImage(uid, file, prefix) {
    const err = acCheckUploads([file], 'logo');
    if (err) return { error: err };
    let body = file, ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg', type = file.type;
    const webp = typeof acMakeThumb === 'function' ? await acMakeThumb(file, 1200) : null;
    if (webp) { body = webp; ext = 'webp'; type = 'image/webp'; }
    const path = uid + '/' + prefix + '-' + Date.now() + '.' + ext;
    const up = await supabaseClient.storage.from('profile-assets').upload(path, body, { contentType: type });
    if (up.error) return { error: up.error.message };
    return { url: supabaseClient.storage.from('profile-assets').getPublicUrl(path).data.publicUrl };
  }

  // ---------- builder rate cards ----------
  async function rates(companyId) {
    const { data } = await supabaseClient.from('company_rates').select('*').eq('company_id', companyId).order('created_at');
    return data || [];
  }
  async function addRate(companyId, r) {
    const { error } = await supabaseClient.from('company_rates').insert({
      company_id: companyId, service: r.service, rate_min: r.rate_min || null, rate_max: r.rate_max || null,
      unit: r.unit || 'per_sqft', includes: r.includes || null, updated_on: r.updated_on || new Date().toISOString().slice(0, 10)
    });
    return error ? { error: error.message } : {};
  }
  async function deleteRate(id) {
    const { error } = await supabaseClient.from('company_rates').delete().eq('id', id);
    return error ? { error: error.message } : {};
  }

  // ---------- relationships (both sides agree; RPCs only) ----------
  async function membershipsForProfessional(pid) {
    const { data } = await supabaseClient.from('agency_members').select('id,status,requested_by,agency:agencies(id,name,is_sample)').eq('professional_id', pid).in('status', ['pending', 'active']);
    return data || [];
  }
  async function membershipsForAgency(aid) {
    const { data } = await supabaseClient.from('agency_members').select('id,status,requested_by,professional:professionals(id,display_name,headline,is_sample)').eq('agency_id', aid).in('status', ['pending', 'active']);
    return data || [];
  }
  async function requestMembership(pid, aid) {
    const { data, error } = await supabaseClient.rpc('request_agency_membership', { p_professional: pid, p_agency: aid });
    return error ? { error: error.message } : { membership: data };
  }
  async function decideMembership(mid, decision) {
    const { error } = await supabaseClient.rpc('decide_agency_membership', { p_membership: mid, p_decision: decision });
    return error ? { error: error.message } : {};
  }
  async function representationsForAgency(aid) {
    const { data } = await supabaseClient.from('project_agencies').select('id,status,project:projects(id,title,city,is_sample)').eq('agency_id', aid).in('status', ['pending', 'active']);
    return data || [];
  }
  async function representationsForProject(pid) {
    const { data } = await supabaseClient.from('project_agencies').select('id,status,agency:agencies(id,name)').eq('project_id', pid).in('status', ['pending', 'active']);
    return data || [];
  }
  async function requestRepresentation(projectId, agencyId) {
    const { error } = await supabaseClient.rpc('request_project_agency', { p_project: projectId, p_agency: agencyId });
    return error ? { error: error.message } : {};
  }
  async function decideRepresentation(id, decision) {
    const { error } = await supabaseClient.rpc('decide_project_agency', { p_link: id, p_decision: decision });
    return error ? { error: error.message } : {};
  }
  // Genuine, visible profiles only, searched by name (never loads a whole table).
  async function searchAgencies(q) {
    const k = String(q || '').replace(/[,()%*\\]/g, ' ').trim();
    if (k.length < 2) return [];
    const { data } = await supabaseClient.from('agencies').select('id,name,city').eq('is_sample', false).eq('moderation_status', 'active').ilike('name', '%' + k + '%').limit(8);
    return data || [];
  }
  async function searchProfessionals(q) {
    const k = String(q || '').replace(/[,()%*\\]/g, ' ').trim();
    if (k.length < 2) return [];
    const { data } = await supabaseClient.from('professionals').select('id,display_name,headline').eq('is_sample', false).eq('moderation_status', 'active').ilike('display_name', '%' + k + '%').limit(8);
    return data || [];
  }
  // Agencies this account can list under: its own + active memberships.
  async function listingAgencies(uid, professionals) {
    const own = await supabaseClient.from('agencies').select('id,name').eq('owner_id', uid);
    const out = (own.data || []).slice();
    for (const p of professionals || []) {
      (await membershipsForProfessional(p.id)).filter(function (m) { return m.status === 'active' && m.agency; })
        .forEach(function (m) { if (!out.some(function (a) { return a.id === m.agency.id; })) out.push(m.agency); });
    }
    return out;
  }

  // ---------- enquiries ----------
  async function enquiries(uid, box) {
    const col = box === 'sent' ? 'sender_id' : 'recipient_id';
    const { data } = await supabaseClient.from('enquiries').select('*').eq(col, uid).neq('status', box === 'sent' ? '__none__' : 'archived').order('created_at', { ascending: false }).limit(50);
    return data || [];
  }
  async function setEnquiryStatus(id, status) {
    const { error } = await supabaseClient.rpc('set_enquiry_status', { p_id: id, p_status: status });
    return error ? { error: error.message } : {};
  }

  return {
    overview: overview, saveEntity: saveEntity, deleteEntity: deleteEntity, uploadImage: uploadImage,
    rates: rates, addRate: addRate, deleteRate: deleteRate,
    membershipsForProfessional: membershipsForProfessional, membershipsForAgency: membershipsForAgency,
    requestMembership: requestMembership, decideMembership: decideMembership,
    representationsForAgency: representationsForAgency, representationsForProject: representationsForProject,
    requestRepresentation: requestRepresentation, decideRepresentation: decideRepresentation,
    searchAgencies: searchAgencies, searchProfessionals: searchProfessionals, listingAgencies: listingAgencies,
    enquiries: enquiries, setEnquiryStatus: setEnquiryStatus
  };
})();
