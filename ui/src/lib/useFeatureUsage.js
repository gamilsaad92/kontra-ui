import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from './authContext';

export default function useFeatureUsage() {
  const { session } = useContext(AuthContext);
  const [usage, setUsage] = useState({});

  useEffect(() => {
    if (!session) return;
    const key = `usage_${session.user.id}`;
    try {
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      setUsage(stored);
    } catch {
      setUsage({});
    }
  }, [session]);

  const recordUsage = label => {
    if (!session) return;
    const key = `usage_${session.user.id}`;
    const updated = { ...usage, [label]: (usage[label] || 0) + 1 };
    setUsage(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  return { usage, recordUsage };
}
