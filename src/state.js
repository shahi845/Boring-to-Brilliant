/**
 * Shared, mutable application state.
 * Every module reads and writes through this single object so that
 * changes made in one module are visible everywhere (ES module imports are read-only bindings).
 */
export const S = {
  db: null, // campus data visible to the signed-in user (filled from Supabase)
  ui: {}, // per-session UI selections (acting student/staff ids)
  role: '', // Student | Staff | Academic Assistant | Admin | Principal | Vice Principal
  page: 'Home',
  section: '',
  pendingOpen: '', // record to open after navigation, e.g. "leave:12"
  sb: null, // Supabase client
  session: null, // Supabase auth session
  profile: null, // row from public.profiles for the signed-in user
};
