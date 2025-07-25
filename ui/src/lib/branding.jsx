import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE } from './apiBase';
import { AuthContext } from './authContext';

const BrandingContext = createContext({ color: '#1e40af', logo: '' });

const roleColors = {
  finance: '#1e40af',
  hospitality: '#047857',
  marketing: '#9d174d'
};

export function BrandingProvider({ children }) {
  const { session } = useContext(AuthContext);
  const [branding, setBranding] = useState({ color: '#1e40af', logo: '' });

    // Update brand color based on user role when session changes
  useEffect(() => {
      if (!session) return;

    const role = session.user?.user_metadata?.role;
    const roleColor = roleColors[role] || '#1e40af';
    setBranding(b => ({ ...b, color: roleColor }));
  }, [session]);

  useEffect(() => {
    if (!session) return;

    const orgId = session.user?.user_metadata?.organization_id;
    if (!orgId) return;
    fetch(`${API_BASE}/api/organizations/${orgId}`)
      .then(r => r.json())
      .then(d => {
        const b = d.organization?.branding;
            if (b) setBranding(prev => ({
          color: b.color || prev.color,
          logo: b.logo || prev.logo
        }));
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
