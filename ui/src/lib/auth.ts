import { useSession as useClerkSession, useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export function useSession() {
  const { session } = useClerkSession();
  return session;
}

export function useAuthToken(): string | null {
  const session = useSession();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchToken() {
      if (session) {
        try {
          const t = await session.getToken({ template: 'supabase' });
          if (active) setToken(t ?? null);
        } catch {
          if (active) setToken(null);
        }
      } else {
        const { data } = await supabase.auth.getSession();
        if (active) setToken(data.session?.access_token ?? null);
      }
    }
    fetchToken();
    return () => {
      active = false;
    };
  }, [session]);

  return token;
}

export function useRole(): string | null {
  const { user } = useUser();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchRole() {
      if (!user) {
        if (active) setRole(null);
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) setRole(data?.role ?? null);
    }
    fetchRole();
    return () => {
      active = false;
    };
  }, [user]);

  return role;
}
