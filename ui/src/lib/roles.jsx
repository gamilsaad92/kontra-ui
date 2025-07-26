import React, { createContext, useContext, useEffect, useState } from 'react';
mport { useUser } from '@clerk/clerk-react';
import { supabase } from './supabaseClient';

const RoleContext = createContext('borrower');

export function RoleProvider({ children }) {
   const { user } = useUser();
  const [role, setRole] = useState('borrower');

  useEffect(() => {
    async function fetchRole() {
    if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
              .eq('user_id', user.id)
        .maybeSingle();
      if (data?.role) setRole(data.role);
    }  
    fetchRole();
  }, [user]);

  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
