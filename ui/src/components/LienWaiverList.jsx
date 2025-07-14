// src/components/LienWaiverList.jsx

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import LienWaiverDetailDrawer from './LienWaiverDetailDrawer';
import LienWaiverChecklist from './LienWaiverChecklist';

export default function LienWaiverList({ filter = {} }) {
  const [waivers, setWaivers] = useState([]);
  const [loading, setLoading] = useState(true);
 const [detailId, setDetailId] = useState(null);
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = new URLSearchParams(filter);
      const res = await fetch(
      `${API_BASE}/api/list-lien-waivers?${params.toString()}`
      );
      const { waivers } = await res.json();
      setWaivers(waivers || []);
      setLoading(false);
    })();
    }, [JSON.stringify(filter)]);

  const exportCsv = async () => {
    const params = new URLSearchParams(filter);
    const res = await fetch(
      `${API_BASE}/api/lien-waivers/export?${params.toString()}`
    );
    const csv = await res.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lien_waivers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (loading) return <p>Loading waivers…</p>;
  if (waivers.length === 0) return <p>No waivers uploaded yet.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
            {filter.draw_id && (
        <div className="mb-4">
          <LienWaiverChecklist drawId={filter.draw_id} />
        </div>
      )}
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-lg font-medium">Uploaded Waivers</h4>
        <button
          onClick={exportCsv}
          className="px-2 py-1 text-sm bg-green-600 text-white rounded"
        >
          Export CSV
        </button>
      </div>
      <ul className="space-y-2">
        {waivers.map(w => (
          <li
            key={w.id}
            className="flex justify-between items-center cursor-pointer hover:bg-gray-50 p-1"
            onClick={() => setDetailId(w.id)}
          >
            <span className="text-blue-600 underline">{w.waiver_type} by {w.contractor_name}</span>
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
            {detailId && (
        <LienWaiverDetailDrawer waiverId={detailId} onClose={() => setDetailId(null)} />
      )}
    </div>
  );
}
