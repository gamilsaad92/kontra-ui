import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function DecisionTimeline() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/decision-history`);
        const data = await res.json();
        if (res.ok) setItems(data.history || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading timeline…</p>;

  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item.id} className="border p-2 rounded">
          <p className="text-sm text-gray-500">
            {item.created_at ? new Date(item.created_at).toLocaleString() : ''}
          </p>
          <p>
            <strong>{item.status}</strong> – {item.comment}
          </p>
        </li>
      ))}
    </ul>
  );
}
