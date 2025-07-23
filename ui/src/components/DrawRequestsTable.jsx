// src/components/DrawRequestsTable.jsx

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import DrawRequestDetail from './DrawRequestDetail';

export default function DrawRequestsTable({ onSelect, canReview = false }) {
  const [draws, setDraws] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', project: '' });
  const [detailId, setDetailId] = useState(null);
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.append(k, v);
        });
        const res = await fetch(`${API_BASE}/api/get-draws?${params.toString()}`);
        const { draws } = await res.json();
        setDraws(draws || []);
      } catch {
        setError('Failed to load draw requests');
      } finally {
        setLoading(false);
      }
    })();
   }, [filters]);

  const exportCsv = async () => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    const res = await fetch(`${API_BASE}/api/draw-requests/export?${params.toString()}`);
    const csv = await res.text();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'draw_requests.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  if (loading) return <p>Loading draw requests…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (draws.length === 0) return <p>No draw requests yet.</p>;

  return (
      <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <div className="flex space-x-2">
        <select
          className="border p-1"
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Any Status</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="funded">funded</option>
          <option value="rejected">rejected</option>
        </select>
        <input
          className="border p-1 flex-1"
          placeholder="Project"
          value={filters.project}
          onChange={e => setFilters({ ...filters, project: e.target.value })}
        />
        <button
          onClick={exportCsv}
          className="px-2 py-1 bg-green-600 text-white rounded"
        >
          Export CSV
        </button>
      </div>
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
                           onClick={() => {
                setDetailId(draw.id);
                onSelect && onSelect(draw.id);
              }}     
            >
              <td className="p-2">{draw.id}</td>
              <td className="p-2">{draw.project}</td>
              <td className="p-2">{draw.amount}</td>
              <td className="p-2">{draw.status}</td>
              <td className="p-2">{new Date(draw.submittedAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
        </table>
      {detailId && (
           <DrawRequestDetail
          drawId={detailId}
          canReview={canReview}
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  );
}
