import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE } from './apiBase';
import { AuthContext } from '../main.jsx';

const BrandingContext = createContext({ color: '#1e40af', logo: '' });

export function BrandingProvider({ children }) {
  const { session } = useContext(AuthContext);
  const [branding, setBranding] = useState({ color: '#1e40af', logo: '' });

  useEffect(() => {
    const orgId = session?.user?.user_metadata?.organization_id;
    if (!orgId) return;
    fetch(`${API_BASE}/api/organizations/${orgId}`)
      .then(r => r.json())
      .then(d => {
        const b = d.organization?.branding;
        if (b) setBranding({ color: b.color || '#1e40af', logo: b.logo || '' });
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (branding.color) {
      document.documentElement.style.setProperty('--brand-color', branding.color);
    }
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
