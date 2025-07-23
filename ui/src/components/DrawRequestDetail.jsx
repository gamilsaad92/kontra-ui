import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';

export default function DrawRequestDetail({ drawId, onClose, canReview = false }) {
  const [draw, setDraw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!drawId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/draw-requests/${drawId}`);
        const data = await res.json();
        if (res.ok) setDraw(data.draw);
      } catch {
        setDraw(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [drawId]);

   const handleAction = async (status, comment) => {
    await fetch(`${API_BASE}/api/review-draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: drawId, status, comment })
    });
    setDraw(d => d ? { ...d, status } : d);
  };

  return (
    <DetailDrawer open={!!drawId} onClose={onClose}>
      {loading && <p>Loading…</p>}
      {!loading && !draw && <p>Not found.</p>}
      {!loading && draw && (
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Draw #{draw.id}</h3>
          <p>Project: {draw.project}</p>
          <p>Amount: {draw.amount}</p>
          <p>Status: {draw.status}</p>
              <p>Submitted: {new Date(draw.submitted_at).toLocaleDateString()}</p>
                   {canReview && draw.status === 'submitted' && (
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handleAction('approved')}
                className="px-2 py-1 bg-green-600 text-white rounded"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const c = prompt('Rejection reason?');
                  if (c) handleAction('rejected', c);
                }}
                className="px-2 py-1 bg-red-600 text-white rounded"
              >
                Reject
              </button>
            </div>
          )}    
        </div>
      )}
    </DetailDrawer>
  );
}
