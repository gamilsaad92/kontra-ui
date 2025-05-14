import React, { useState, useEffect } from 'react';

// Placeholder table for listing draw requests; fetch and render data here
export default function DrawRequestsTable() {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDraws() {
      try {
        const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/get-draws`);
        const data = await res.json();
        setDraws(data.draws || []);
      } catch (err) {
        console.error('Error fetching draws:', err);
        setError('Failed to load draw requests');
      } finally {
        setLoading(false);
      }
    }
    fetchDraws();
  }, []);

  if (loading) return <p className="text-center text-gray-500">Loading draw requests...</p>;
  if (error) return <p className="text-center text-red-500">{error}</p>;
  if (draws.length === 0) return <p className="text-center text-gray-500">No draw requests found.</p>;

  return (
    <div className="overflow-auto">
      <table className="min-w-full bg-white rounded-lg shadow">
        <thead>
          <tr className="bg-gray-200 text-left">
            {['ID', 'Project', 'Proj #', 'Location', 'Amount', 'Status', 'Risk'].map((header) => (
              <th key={header} className="px-4 py-2 font-medium text-gray-700">{header}</th>
            ))}
            <th className="px-4 py-2 font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((draw) => (
            <tr key={draw.id} className="border-t">
              <td className="px-4 py-2">{draw.id}</td>
              <td className="px-4 py-2">{draw.project}</td>
              <td className="px-4 py-2">{draw.project_number}</td>
              <td className="px-4 py-2">{draw.property_location}</td>
              <td className="px-4 py-2">${draw.amount}</td>
              <td className="px-4 py-2">{draw.status.toUpperCase()}</td>
              <td className="px-4 py-2">{draw.riskScore}/100</td>
              <td className="px-4 py-2 space-x-2">
                <button className="px-2 py-1 bg-green-500 text-white rounded">Approve</button>
                <button className="px-2 py-1 bg-red-500 text-white rounded">Reject</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
