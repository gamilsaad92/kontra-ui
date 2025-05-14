import React, { useState, useEffect } from 'react';

export default function LienWaiverList({ drawId }) {
  const [waivers, setWaivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadWaivers() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/list-lien-waivers?draw_id=${drawId}`
        );
        const { waivers } = await res.json();
        setWaivers(waivers || []);
      } catch (err) {
        console.error('Error loading waivers:', err);
        setError('Failed to load waivers');
      } finally {
        setLoading(false);
      }
    }
    if (drawId) loadWaivers();
  }, [drawId]);

  if (!drawId) return <p className="text-gray-500">Select a draw to view waivers.</p>;
  if (loading) return <p>Loading waivers...</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!waivers.length) return <p className="text-gray-500">No waivers found.</p>;

  return (
    <ul className="space-y-2">
      {waivers.map(w => (
        <li key={w.id} className="p-2 bg-white rounded shadow flex justify-between">
          <div>
            <strong>{w.contractor_name}</strong> ({w.waiver_type})
          </div>
          <span className={w.verification_passed ? 'text-green-600' : 'text-red-600'}>
            {w.verification_passed ? 'Verified' : 'Issues'}
          </span>
        </li>
      ))}
    </ul>
  );
}
