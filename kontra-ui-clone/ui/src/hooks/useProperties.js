import { useState, useCallback } from "react";

const STORAGE_KEY = "kontra_my_properties";

/**
 * Persistent property store backed by localStorage.
 * `properties` = null means first-ever visit (show onboarding).
 * `properties` = []   means user cleared all properties.
 * `properties` = [...] means user has properties.
 */
export function useProperties() {
  const [properties, setProperties] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === null) return null; // first visit
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });

  const isFirstVisit = properties === null;
  const propertyList = properties || [];

  const addProperty = useCallback((data) => {
    const newProp = {
      id: `prop-${Date.now()}`,
      name: data.name,
      type: data.type,
      address: data.address,
      city: data.city,
      state: data.state,
      units: data.units ? Number(data.units) : null,
      sqft: data.sqft ? Number(data.sqft) : null,
      yearBuilt: data.yearBuilt ? Number(data.yearBuilt) : null,
      occupancy: data.occupancy ? Number(data.occupancy) : null,
      noi: data.noi || null,
      status: "Active",
      risk: "Unknown",
      riskColor: "#6b7280",
      score: null,
      documents: [],
      inspections: [],
      createdAt: new Date().toISOString(),
    };
    setProperties((prev) => {
      const updated = [...(prev || []), newProp];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return newProp;
  }, []);

  const updateProperty = useCallback((id, updates) => {
    setProperties((prev) => {
      const updated = (prev || []).map((p) => (p.id === id ? { ...p, ...updates } : p));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeProperty = useCallback((id) => {
    setProperties((prev) => {
      const updated = (prev || []).filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { properties: propertyList, isFirstVisit, addProperty, updateProperty, removeProperty };
}
