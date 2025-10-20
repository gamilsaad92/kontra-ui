// src/lib/supabaseClient.js

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let supabase;

if (isSupabaseConfigured) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.error(
    'Supabase environment variables are missing. ' +
    'Authentication and data features will be disabled.'
  );
  const stub = async () => ({ error: new Error('Supabase not configured'), data: null });
  supabase = {
    auth: {
      getSession: stub,
      getSessionFromUrl: stub,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: stub,
      signInWithOtp: stub,
      signUp: stub,
      signOut: stub
     },
    rpc: () => stub(),
    from: () => ({ select: () => stub() })
  };
}

export { supabase };
