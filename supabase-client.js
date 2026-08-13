// AgenticCore Estate — Supabase client configuration (NOT YET WIRED UP)
// ------------------------------------------------------------
// No Supabase project has been provisioned for this repo yet, so no page
// currently includes this file — every page uses mock-db.js (a localStorage
// stand-in) instead. Once a real project exists:
//   1. Run supabase/migrations/0001_init_estate_schema.sql against it.
//   2. Fill in the URL + publishable (anon) key below.
//   3. Replace the AcDB.* calls in mock-db.js's callers with calls against
//      `supabaseClient` (auth.signUp/signInWithPassword, .from('listings')...),
//      using the same function names so page code doesn't need to change.
//
// The publishable key is safe for browser use — security is enforced by the
// Row Level Security policies defined in the migration above.

const SUPABASE_URL = 'REPLACE_WITH_SUPABASE_PROJECT_URL';
const SUPABASE_PUBLISHABLE_KEY = 'REPLACE_WITH_SUPABASE_PUBLISHABLE_KEY';

const supabaseClient = (typeof window !== 'undefined' && window.supabase && SUPABASE_URL.indexOf('REPLACE_WITH') === -1)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;
