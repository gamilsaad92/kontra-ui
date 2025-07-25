import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './authContext';
import { supabase } from './supabaseClient';

const RoleContext = createContext('borrower');

export function RoleProvider({ children }) {
const { session } = useContext(AuthContext);
  const [role, setRole] = useState('borrower');

  useEffect(() => {
    async function fetchRole() {
        if (!session) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
       .eq('user_id', session.user.id)
        .maybeSingle();
      if (data?.role) setRole(data.role);
    }
    fetchRole();
  }, [session]);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
