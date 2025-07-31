import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE } from './apiBase';
import { AuthContext } from './authContext';
import { colors } from '../theme.js';

const BrandingContext = createContext({ color: colors.brand.primary, logo: '' });

export function BrandingProvider({ children }) {
  const { session } = useContext(AuthContext);
  const [branding, setBranding] = useState({ color: colors.brand.primary, logo: '' });

  // Load organization branding but keep accent color fixed
  useEffect(() => {
    if (!session) return;
    const orgId = session.user?.user_metadata?.organization_id;
    if (!orgId) return;
    fetch(`${API_BASE}/api/organizations/${orgId}`)
      .then(r => r.json())
      .then(d => {
        const b = d.organization?.branding;
        if (b) setBranding(prev => ({ ...prev, logo: b.logo || prev.logo }));
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-color', colors.brand.primary);
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
  );
}

export function useBranding() {
  return useContext(BrandingContext);
}
