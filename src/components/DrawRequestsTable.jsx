import React, { useState, useEffect } from 'react';

export default function DrawRequestsTable({ onSelect }) {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDraws = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/get-draws`);
      const { draws } = await res.json();
      setDraws(draws || []);
    } catch {
      setError('Failed to load draw requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDraws(); }, []);

  const reviewDraw = async (id, status) => {
    await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/review-draw`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ id, status })
    });
    fetchDraws();
  };

  if (loading) return <p className="text-center text-gray-500">Loading draw requests...</p>;
  if (error)   return <p className="text-center text-red-500">{error}</p>;
  if (!draws.length) return <p className="text-center text-gray-500">No draw requests found.</p>;

  return (
    <div className="overflow-auto">
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead className="bg-gray-200">
          <tr>
            {['ID','Project','Proj #','Location','Amount','Status','Risk','Actions'].map(h => (
              <th key={h} className="px-4 py-2">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {draws.map(draw => (
            <tr key={draw.id} className="border-t cursor-pointer" onClick={() => onSelect?.(draw.id)}>
              <td className="px-4 py-2">{draw.id}</td>
              <td className="px-4 py-2">{draw.project}</td>
              <td className="px-4 py-2">{draw.project_number}</td>
              <td className="px-4 py-2">{draw.property_location}</td>
              <td className="px-4 py-2">${draw.amount}</td>
              <td className="px-4 py-2">{draw.status.toUpperCase()}</td>
              <td className="px-4 py-2">{draw.riskScore}/100</td>
              <td className="px-4 py-2 space-x-2">
                <button onClick={() => reviewDraw(draw.id, 'approved')} className="px-2 py-1 bg-green-500 text-white rounded">
                  Approve
                </button>
                <button onClick={() => reviewDraw(draw.id, 'rejected')} className="px-2 py-1 bg-red-500 text-white rounded">
                  Reject
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
