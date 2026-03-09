import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const isPlaceholderValue = (value = '') =>
  value.includes('<') || value.includes('>') || value.toUpperCase().includes('YOUR_');

const isValidHttpUrl = (value = '') => {
  if (!value || isPlaceholderValue(value)) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const hasValidSupabaseUrl = isValidHttpUrl(supabaseUrl);
const hasValidAnonKey = Boolean(supabaseAnonKey) && !isPlaceholderValue(supabaseAnonKey);

export const isSupabaseConfigured = hasValidSupabaseUrl && hasValidAnonKey;

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
