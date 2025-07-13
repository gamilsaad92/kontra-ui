import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';

export default function DrawRequestDetail({ drawId, onClose }) {
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
        </div>
      )}
    </DetailDrawer>
  );
}
