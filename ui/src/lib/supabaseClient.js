import { createClient } from '@supabase/supabase-js';
import { resolveSupabaseConfig } from './supabaseConfig.mjs';

const supabaseConfig = resolveSupabaseConfig({
  context: import.meta.env.VITE_SUPABASE_DEPLOYMENT_CONTEXT || 'local',
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
const { url: supabaseUrl, anonKey: supabaseAnonKey } = supabaseConfig;
export const isSupabaseConfigured = supabaseConfig.configured;

if (!isSupabaseConfigured && typeof console !== 'undefined') {
  console.warn(
    'Supabase is not configured with valid values. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable authentication features.'
  );
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window === 'undefined' ? undefined : window.localStorage,
      },
    })
  : null;
