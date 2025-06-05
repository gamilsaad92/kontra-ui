// src/components/LienWaiverList.jsx

import React, { useEffect, useState } from 'react';

export default function LienWaiverList({ drawId }) {
  const [waivers, setWaivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/list-lien-waivers?draw_id=${drawId}`
      );
      const { waivers } = await res.json();
      setWaivers(waivers || []);
      setLoading(false);
    })();
  }, [drawId]);

  if (loading) return <p>Loading waivers…</p>;
  if (waivers.length === 0) return <p>No waivers uploaded yet.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      <h4 className="text-lg font-medium mb-2">Uploaded Waivers</h4>
      <ul className="space-y-2">
        {waivers.map(w => (
          <li key={w.id} className="flex justify-between items-center">
            <a
              href={w.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {w.waiver_type} by {w.contractor_name}
            </a>
            <span
              className={`px-2 py-1 rounded text-sm ${
                w.verification_passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {w.verification_passed ? 'Verified' : 'Failed'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
