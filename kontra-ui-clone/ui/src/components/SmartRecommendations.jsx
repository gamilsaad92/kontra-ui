import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function SmartRecommendations() {
  const [data, setData] = useState({ at_risk_loans: [], upsell_guests: [] });
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/recommendations`);
        const d = await res.json();
        setData(d);
      } catch {
        setData({ at_risk_loans: [], upsell_guests: [] });
      }
    })();
  }, []);

  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Smart Recommendations</h3>
      <p className="text-sm font-semibold">Top At-Risk Loans</p>
      <ul className="list-disc list-inside text-sm mb-2">
        {data.at_risk_loans.map(l => (
          <li key={l.id}>{l.name || l.id} – risk {l.predicted_risk}</li>
        ))}
      </ul>
      <p className="text-sm font-semibold">Guests Likely to Upsell</p>
      <ul className="list-disc list-inside text-sm">
        {data.upsell_guests.map(g => (
          <li key={g.id}>{g.name}</li>
        ))}
      </ul>
    </div>
  );
}
