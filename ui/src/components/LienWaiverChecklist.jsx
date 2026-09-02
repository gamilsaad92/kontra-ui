import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LienWaiverChecklist({ drawId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (drawId) fetchList();
  }, [drawId]);

  async function fetchList() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/waiver-checklist/${drawId}`);
      const data = await res.json();
      setItems(data.checklist || []);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>Loading checklist…</p>;

  return (
    <ul className="space-y-1">
      {items.map((it) => (
        <li key={it.item} className="flex items-center">
          <input type="checkbox" checked={it.completed} readOnly className="mr-2" />
          <span>{it.item}</span>
        </li>
      ))}
    </ul>
  );
}
