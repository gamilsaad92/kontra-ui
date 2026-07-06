import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const PORTAL_MAP = {
  '/borrower':  'borrower',
  '/investor':  'investor',
  '/servicer':  'servicer',
  '/dashboard': 'lender',
};

function detectPortal(path) {
  for (const [prefix, portal] of Object.entries(PORTAL_MAP)) {
    if (path.startsWith(prefix)) return portal;
  }
  return 'other';
}

export function useVisitorTracking() {
  const location = useLocation();
  const tracked = useRef(new Set());

  useEffect(() => {
    const key = location.pathname;
    if (tracked.current.has(key)) return;
    tracked.current.add(key);

    const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');

    fetch(`${apiBase}/api/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page:     key,
        portal:   detectPortal(key),
        referrer: document.referrer || '',
      }),
    }).catch(() => {});
  }, [location.pathname]);
}
