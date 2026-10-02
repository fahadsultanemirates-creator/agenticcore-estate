/* ============================================
   AgenticCore Estate — marketplace data layer (Marketplace V2)
   ------------------------------------------------
   Five public categories, all read through Row Level Security with the
   public key:
     properties    → listings
     projects      → projects
     professionals → professionals
     agencies      → agencies
     builders      → companies
   Rules this file keeps (the database enforces them too):
   - Genuine and sample content are always queried separately
     (is_sample = false / true); samples are only used to top up thin
     rows and are always rendered with a SAMPLE badge.
   - Pages are fetched with .range(): nothing loads a whole table.
   - Placement only affects order when the admin-controlled setting
     paid_placement_active is on (it is off until packages launch).
   ============================================ */

const AC_MARKET_CATS = {
  properties: {
    table: 'listings', type: 'listing',
    select: 'id,owner_id,title,type,property_type,city,area,price,beds,baths,size_marla,size_unit,photos,thumbs,verified,last_confirmed_at,created_at,is_sample,placement,agency_id,professional_id,project_id,' +
      'agency:agencies(id,name,logo_url),professional:professionals(id,display_name,avatar_url)'
  },
  projects: {
    table: 'projects', type: 'project',
    select: 'id,owner_id,title,city,area,status,project_type,unit_types,size_from,size_to,size_unit,price_from,price_to,payment_plan,possession_date,photos,thumbs,brochure_path,verified,is_sample,placement,created_at,company_id,' +
      'company:companies(id,name,logo_url)'
  },
  professionals: {
    table: 'professionals', type: 'professional',
    select: 'id,owner_id,display_name,avatar_url,avatar_kind,headline,cities,areas_served,segments,purposes,property_types,services,languages,overseas_clients,verified,is_sample,placement,created_at'
  },
  agencies: {
    table: 'agencies', type: 'agency',
    select: 'id,owner_id,name,logo_url,cover_url,description,city,cities,services,segments,purposes,verified,is_sample,placement,created_at'
  },
  builders: {
    table: 'companies', type: 'company',
    select: 'id,owner_id,name,logo_url,description,cities,services,verified,is_sample,placement,created_at,company_rates(service,rate_min,rate_max,unit,updated_on)'
  }
};

const AcMarket = (function () {
  let settingsPromise = null;
  function settings() {
    if (!settingsPromise) {
      settingsPromise = supabaseClient.from('marketplace_settings').select('key,value')
        .then(function (r) {
          const out = { samples_visible: true, sample_fill_min: 5, paid_placement_active: false, packages_launch_at: '2026-11-01T00:00:00+05:00' };
          (r.data || []).forEach(function (row) { out[row.key] = row.value; });
          return out;
        })
        .catch(function () { return { samples_visible: true, sample_fill_min: 5, paid_placement_active: false }; });
    }
    return settingsPromise;
  }

  function clean(s) { return String(s || '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 80); }

  // Category-specific filters. Every filter is a plain equality / range /
  // array-contains check, so it maps onto an index and never needs the
  // whole table in the browser.
  function applyFilters(q, cat, f) {
    f = f || {};
    if (cat === 'properties') {
      if (f.purpose) q = q.eq('type', f.purpose);
      if (f.city) q = q.eq('city', f.city);
      if (f.area) q = q.eq('area', f.area);
      if (f.propertyType) q = q.eq('property_type', f.propertyType);
      if (f.minPrice) q = q.gte('price', Number(f.minPrice));
      if (f.maxPrice) q = q.lte('price', Number(f.maxPrice));
      if (f.beds) q = q.gte('beds', Number(f.beds));
      if (f.agency) q = q.eq('agency_id', f.agency);
      if (f.professional) q = q.eq('professional_id', f.professional);
      if (f.project) q = q.eq('project_id', f.project);
      if (f.q && clean(f.q)) { const k = clean(f.q); q = q.or('title.ilike.%' + k + '%,area.ilike.%' + k + '%,city.ilike.%' + k + '%'); }
    } else if (cat === 'projects') {
      if (f.city) q = q.eq('city', f.city);
      if (f.status) q = q.eq('status', f.status);
      if (f.projectType) q = q.eq('project_type', f.projectType);
      if (f.company) q = q.eq('company_id', f.company);
      if (f.q && clean(f.q)) { const k = clean(f.q); q = q.or('title.ilike.%' + k + '%,area.ilike.%' + k + '%'); }
    } else if (cat === 'professionals') {
      if (f.city) q = q.contains('cities', [f.city]);
      if (f.area) q = q.contains('areas_served', [f.area]);
      if (f.purpose) q = q.contains('purposes', [f.purpose]);
      if (f.segment) q = q.contains('segments', [f.segment]);
      if (f.q && clean(f.q)) { const k = clean(f.q); q = q.or('display_name.ilike.%' + k + '%,headline.ilike.%' + k + '%'); }
    } else if (cat === 'agencies') {
      if (f.city) q = q.contains('cities', [f.city]);
      if (f.segment) q = q.contains('segments', [f.segment]);
      if (f.purpose) q = q.contains('purposes', [f.purpose]);
      if (f.q && clean(f.q)) q = q.ilike('name', '%' + clean(f.q) + '%');
    } else if (cat === 'builders') {
      if (f.city) q = q.contains('cities', [f.city]);
      if (f.service) q = q.contains('services', [f.service]);
      if (f.q && clean(f.q)) q = q.ilike('name', '%' + clean(f.q) + '%');
    }
    return q;
  }

  function applySort(q, cat, sort, s) {
    // Future packages: only when the admin switches paid placement on does
    // placement change the order — and cards then carry a visible label.
    if (s.paid_placement_active === true) q = q.order('placement', { ascending: true });
    if (cat === 'properties' && sort === 'price_asc') return q.order('price', { ascending: true });
    if (cat === 'properties' && sort === 'price_desc') return q.order('price', { ascending: false });
    return q.order('created_at', { ascending: false });
  }

  // One page of GENUINE results + the total matching count.
  async function browse(cat, filters, page, pageSize, sort) {
    const c = AC_MARKET_CATS[cat];
    const s = await settings();
    page = page || 0; pageSize = pageSize || 12;
    let q = supabaseClient.from(c.table).select(c.select, { count: 'exact' })
      .eq('is_sample', false).eq('moderation_status', 'active');
    q = applySort(applyFilters(q, cat, filters), cat, sort, s);
    const { data, error, count } = await q.range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) return { rows: [], total: 0, error: error.message };
    return { rows: data || [], total: count || 0 };
  }

  async function samples(cat, limit) {
    const s = await settings();
    if (s.samples_visible === false) return [];
    const c = AC_MARKET_CATS[cat];
    const { data } = await supabaseClient.from(c.table).select(c.select)
      .eq('is_sample', true).order('id', { ascending: true }).limit(limit || 10);
    return data || [];
  }

  // Homepage row: genuine items first; samples only top the row up to the
  // configured minimum, after the genuine ones, never replacing them.
  async function row(cat, limit) {
    const s = await settings();
    const genuine = await browse(cat, {}, 0, limit || 10);
    // The same item posted several times shows once on the homepage row
    // (the directory still lists every record).
    const seen = {};
    const rows = genuine.rows.filter(function (it) {
      const k = cat === 'properties'
        ? [it.title, it.type, it.price, it.city, it.area, it.size_marla].join('|').toLowerCase()
        : String(it.id);
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
    const min = Number(s.sample_fill_min) || 0;
    let filler = [];
    if (rows.length < min) filler = (await samples(cat, min - rows.length));
    return { items: rows.concat(filler), genuineTotal: genuine.total, sampleCount: filler.length };
  }

  async function stats() {
    const { data } = await supabaseClient.rpc('marketplace_stats');
    return data || { properties: 0, projects: 0, professionals: 0, agencies: 0, companies: 0, by_city: {}, popular_areas: [] };
  }

  // ---------- details (with their public relationships) ----------
  async function getProject(id) {
    const { data } = await supabaseClient.from('projects')
      .select('*,company:companies(id,name,logo_url,is_sample)').eq('id', id).maybeSingle();
    if (!data) return null;
    const [units, reps] = await Promise.all([
      supabaseClient.from('listings').select(AC_MARKET_CATS.properties.select).eq('project_id', id).eq('moderation_status', 'active').limit(12),
      supabaseClient.from('project_agencies').select('id,status,agency:agencies(id,name,logo_url,is_sample)').eq('project_id', id).eq('status', 'active')
    ]);
    data.units = units.data || [];
    data.agencies = (reps.data || []).map(function (r) { return r.agency; }).filter(Boolean);
    return data;
  }

  async function getProfessional(id) {
    const { data } = await supabaseClient.from('professionals').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    const [mem, listings] = await Promise.all([
      supabaseClient.from('agency_members').select('id,status,agency:agencies(id,name,logo_url,is_sample)').eq('professional_id', id).eq('status', 'active'),
      supabaseClient.from('listings').select(AC_MARKET_CATS.properties.select).eq('professional_id', id).eq('moderation_status', 'active').order('created_at', { ascending: false }).limit(12)
    ]);
    data.agencies = (mem.data || []).map(function (m) { return m.agency; }).filter(Boolean);
    data.listings = listings.data || [];
    return data;
  }

  async function getAgency(id) {
    const { data } = await supabaseClient.from('agencies').select('*').eq('id', id).maybeSingle();
    if (!data) return null;
    const [team, listings, projects] = await Promise.all([
      supabaseClient.from('agency_members').select('id,status,professional:professionals(id,display_name,avatar_url,headline,is_sample)').eq('agency_id', id).eq('status', 'active'),
      supabaseClient.from('listings').select(AC_MARKET_CATS.properties.select).eq('agency_id', id).eq('moderation_status', 'active').order('created_at', { ascending: false }).limit(12),
      supabaseClient.from('project_agencies').select('id,status,project:projects(id,title,city,area,status,thumbs,photos,is_sample)').eq('agency_id', id).eq('status', 'active')
    ]);
    data.team = (team.data || []).map(function (m) { return m.professional; }).filter(Boolean);
    data.listings = listings.data || [];
    data.projects = (projects.data || []).map(function (p) { return p.project; }).filter(Boolean);
    return data;
  }

  async function getCompany(id) {
    const { data } = await supabaseClient.from('companies').select('*,company_rates(*)').eq('id', id).maybeSingle();
    if (!data) return null;
    const { data: projects } = await supabaseClient.from('projects').select(AC_MARKET_CATS.projects.select)
      .eq('company_id', id).eq('moderation_status', 'active').order('created_at', { ascending: false }).limit(12);
    data.projects = projects || [];
    return data;
  }

  // ---------- contact + enquiries (signed-in only; never samples) ----------
  async function contact(type, id) {
    const { data, error } = await supabaseClient.rpc('get_marketplace_contact', { p_type: type, p_id: id });
    if (error) return { error: error.message };
    return { contact: (data || [])[0] || null };
  }
  async function enquire(type, id, message, phone) {
    const { data, error } = await supabaseClient.rpc('send_enquiry', { p_type: type, p_id: id, p_message: message, p_phone: phone || null });
    if (error) return { error: error.message };
    return { id: data };
  }

  return {
    settings: settings, browse: browse, samples: samples, row: row, stats: stats,
    getProject: getProject, getProfessional: getProfessional, getAgency: getAgency, getCompany: getCompany,
    contact: contact, enquire: enquire
  };
})();
