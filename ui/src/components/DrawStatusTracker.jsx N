import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function DrawStatusTracker({ drawId }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!drawId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/draw-requests/${drawId}/history`);
        const data = await res.json();
        if (res.ok) setHistory(data.history || []);
      } catch {
        setHistory([]);
      }
    })();
  }, [drawId]);

  if (!drawId) return null;

  const steps = ['submitted', 'under_review', 'approved', 'rejected'];

  return (
    <ol className="space-y-2">
      {steps.map(step => {
        const item = history.find(h => h.status === step);
        return (
          <li key={step} className="flex items-center space-x-2">
            <span className="font-semibold capitalize">{step.replace('_', ' ')}</span>
            {item && (
              <span className="text-xs text-gray-500">
                {new Date(item.created_at).toLocaleString()}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
