import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

const COLUMNS = [
  { key: 'submitted', title: 'Requested' },
  { key: 'under_review', title: 'Under Review' },
  { key: 'approved', title: 'Approved' },
  { key: 'funded', title: 'Funded' }
];

export default function DrawKanbanBoard() {
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDraws();
  }, []);

  async function fetchDraws() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/get-draws`);
      const { draws } = await res.json();
      setDraws(draws || []);
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id, status) {
    await fetch(`${API_BASE}/api/review-draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
  }

  function handleDrop(e, status) {
    const id = e.dataTransfer.getData('id');
    updateStatus(id, status);
    setDraws((d) => d.map((dr) => (dr.id === parseInt(id) ? { ...dr, status } : dr)));
  }

  if (loading) return <p>Loading draw requests…</p>;

  return (
    <div className="flex space-x-4">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, col.key)}
          className="flex-1 bg-gray-100 p-2 rounded"
        >
          <h3 className="text-lg font-bold mb-2">{col.title}</h3>
          {draws
            .filter((d) => d.status === col.key)
            .map((d) => (
              <div
                key={d.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('id', d.id)}
                className="bg-white p-2 mb-2 shadow rounded"
              >
                <p className="font-semibold">#{d.id} – {d.project}</p>
                <p className="text-sm">${d.amount}</p>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
