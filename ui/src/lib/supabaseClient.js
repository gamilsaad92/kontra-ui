// src/lib/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isPlaceholder = value =>
  typeof value === 'string' && (value.includes('<') || value.includes('YOUR_') || value.includes('your-project-ref'));
const isMeaningful = value => Boolean(value && !isPlaceholder(value));

export const isSupabaseConfigured = isMeaningful(supabaseUrl) && isMeaningful(supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : {
      auth: {
        getSession: async () => ({ error: new Error('Supabase not configured'), data: null }),
        getSessionFromUrl: async () => ({ error: new Error('Supabase not configured'), data: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        signInWithPassword: async () => ({ error: new Error('Supabase not configured'), data: null }),
        signInWithOtp: async () => ({ error: new Error('Supabase not configured'), data: null }),
        signUp: async () => ({ error: new Error('Supabase not configured'), data: null }),
        signOut: async () => ({ error: new Error('Supabase not configured'), data: null }),
      },
      rpc: async () => ({ error: new Error('Supabase not configured'), data: null }),
      from: () => ({ select: async () => ({ error: new Error('Supabase not configured'), data: null }) }),
    };

if (!isSupabaseConfigured) {
  console.error(
   'Supabase environment variables are missing. Authentication and data features will be disabled.'
  );
}
