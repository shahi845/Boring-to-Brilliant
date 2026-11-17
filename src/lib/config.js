/**
 * Runtime configuration.
 * Vite injects VITE_* variables from .env at build time. Only public values belong here:
 * the Supabase anon key is designed to be public — Row Level Security protects the data.
 * The service-role key is used ONLY by the API server and must never be prefixed with VITE_.
 */
const env = import.meta.env || {};
const runtime = (typeof window !== 'undefined' && window.__OURCAMPUS_CONFIG__) || {};

export const config = {
  supabaseUrl: env.VITE_SUPABASE_URL || runtime.supabaseUrl || '',
  supabaseAnonKey: env.VITE_SUPABASE_ANON_KEY || runtime.supabaseAnonKey || '',
  apiUrl: (env.VITE_API_URL ?? runtime.apiUrl ?? '').replace(/\/$/, ''), // '' = same origin
};
