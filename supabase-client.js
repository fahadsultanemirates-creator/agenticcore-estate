// AgenticCore Estate — Supabase client configuration
// ------------------------------------------------------------
// Project: Agenticcore-estate (dedicated to this site, separate from
// the AgenticCore token site's project, so real-estate identity/CNIC
// data never mixes with unrelated data).
//
// The publishable (anon) key is safe for browser use — access is
// enforced by the Row Level Security policies in
// supabase/migrations/0001_init_estate_schema.sql and
// supabase/migrations/0002_launch_cities_property_types_photos.sql.

const SUPABASE_URL = 'https://iuwjlvcfnxbfhbkztsel.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_h6IgoqSDyVscFbKVaxWMiQ_Lsws9lWv';

const supabaseClient = (typeof window !== 'undefined' && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
