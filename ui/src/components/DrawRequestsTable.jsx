// src/components/DrawRequestsTable.jsx

import React, { useEffect, useState } from 'react';

export default function DrawRequestsTable({ onSelect }) {
  const [draws, setDraws] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/get-draws`);
        const { draws } = await res.json();
        setDraws(draws || []);
      } catch {
        setError('Failed to load draw requests');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading draw requests…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (draws.length === 0) return <p>No draw requests yet.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Project</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
            <th className="p-2">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {draws.map(draw => (
            <tr
              key={draw.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect(draw.id)}
            >
              <td className="p-2">{draw.id}</td>
              <td className="p-2">{draw.project}</td>
              <td className="p-2">${draw.amount}</td>
              <td className="p-2">{draw.status}</td>
              <td className="p-2">{new Date(draw.submittedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
