import { useState, useCallback, useEffect, useContext } from "react";
import { AuthContext } from "../lib/authContext";

const LS_KEY = "kontra_my_properties";
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

function mapLocalProp(data) {
  return {
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: data.name,
    type: data.type,
    address: data.address,
    city: data.city,
    state: data.state,
    units: data.units ? Number(data.units) : null,
    sqft: data.sqft ? Number(data.sqft) : null,
    yearBuilt: data.yearBuilt ? Number(data.yearBuilt) : null,
    occupancy: data.occupancy ? Number(data.occupancy) : null,
    noi: data.noi ? Number(data.noi) : null,
    status: "Active",
    risk: "Unknown",
    riskColor: "#6b7280",
    createdAt: new Date().toISOString(),
  };
}

/**
 * Persistent property store.
 * - Authenticated: reads/writes via API (/api/user-properties), mirrors to localStorage.
 * - Unauthenticated: localStorage only.
 * - `properties === null` means first-ever visit (show onboarding).
 */
export function useProperties() {
  const { session } = useContext(AuthContext);
  const token = session?.access_token || null;

  const [properties, setProperties] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored === null ? null : JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // When user logs in, fetch their properties from API
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    apiFetch("/api/user-properties", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((data) => {
        const apiProps = data.properties || [];
        // Read what's currently in localStorage
        let localProps = [];
        try {
          const raw = localStorage.getItem(LS_KEY);
          localProps = raw ? JSON.parse(raw) : [];
        } catch { /* ignore */ }

        if (apiProps.length > 0) {
          // API has data — it's the source of truth
          setProperties(apiProps);
          localStorage.setItem(LS_KEY, JSON.stringify(apiProps));
        } else if (localProps.length > 0) {
          // API returned empty but we have local data (e.g. API was down during save)
          // Keep local data and push it up to the API so it persists
          setProperties(localProps);
          localProps.forEach((p) => {
            apiFetch("/api/user-properties", {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify(p),
            }).catch(() => {/* best-effort sync */});
          });
        } else {
          // Genuinely empty — new user
          setProperties([]);
          localStorage.setItem(LS_KEY, JSON.stringify([]));
        }
      })
      .catch(() => {
        // API unavailable — keep whatever is in state/localStorage, still works
      })
      .finally(() => setLoading(false));
  }, [token]);

  const isFirstVisit = properties === null;
  const propertyList = properties || [];

  const addProperty = useCallback(
    async (data) => {
      if (token) {
        try {
          const result = await apiFetch("/api/user-properties", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
          });
          const newProp = result.property || mapLocalProp(data);
          setProperties((prev) => {
            const updated = [...(prev || []), newProp];
            localStorage.setItem(LS_KEY, JSON.stringify(updated));
            return updated;
          });
          return newProp;
        } catch {
          // Fall through to localStorage
        }
      }
      const local = mapLocalProp(data);
      setProperties((prev) => {
        const updated = [...(prev || []), local];
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      });
      return local;
    },
    [token]
  );

  const updateProperty = useCallback((id, updates) => {
    setProperties((prev) => {
      const updated = (prev || []).map((p) => (p.id === id ? { ...p, ...updates } : p));
      localStorage.setItem(LS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeProperty = useCallback(
    async (id) => {
      if (token) {
        try {
          await apiFetch(`/api/user-properties/${id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Continue with local removal
        }
      }
      setProperties((prev) => {
        const updated = (prev || []).filter((p) => p.id !== id);
        localStorage.setItem(LS_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [token]
  );

  return { properties: propertyList, isFirstVisit, loading, addProperty, updateProperty, removeProperty };
}
