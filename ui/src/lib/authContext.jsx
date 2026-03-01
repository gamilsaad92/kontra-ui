import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as supabaseClient, isSupabaseConfigured } from './supabaseClient';

export const AuthContext = createContext({
  session: null,
  user: null,
  supabase: null,
   loading: true,
  isLoading: true,
    isAuthed: false,
  signOut: async () => ({ error: null }),
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    
     const hydrateSession = async () => {
      if (!isSupabaseConfigured) {
        if (isActive) {
          setSession(null);
             setLoading(false);
        }
           return;
      }

      const { data, error } = await supabaseClient.auth.getSession();
      if (!isActive) {
        return;
      }

      if (error) {
        console.error('Failed to fetch Supabase session', error);
        setSession(null);
      } else {
        setSession(data?.session ?? null);
      }
       
      setLoading(false);   
    };

     hydrateSession();

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      if (!isActive) {
        return;
      }  
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
     isActive = false;
      subscription?.unsubscribe();
       };
  }, []);

  const signOut = useCallback(async () => {
     if (!isSupabaseConfigured) {
    setSession(null);
      return { error: new Error('Supabase not configured') };
    }

    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      console.error('Failed to sign out', error);
      return { error };
    }
    
    setSession(null);
    return { error: null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      supabase: isSupabaseConfigured ? supabaseClient : null,
        loading,
      isLoading: loading,
      isAuthed: Boolean(session?.user),
      signOut,
    }),
    [session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
