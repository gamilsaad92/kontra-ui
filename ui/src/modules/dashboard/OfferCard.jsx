import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

export default function OfferCard() {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/suggest-upsells`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest_id: 1 })
        });
        const { suggestions } = await res.json();
        setOffers(suggestions || []);
      } catch {
        setOffers([]);
      }
    })();
  }, []);

  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Recommended Offers</h3>
      <ul className="list-disc list-inside text-sm space-y-1">
        {offers.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
    </div>
  );
}
