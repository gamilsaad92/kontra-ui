import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';
import DrawStatusTracker from './DrawStatusTracker';
import Form1140Stepper from './Form1140/Form1140Stepper';
import LienWaiverForm from './LienWaiverForm';
import LienWaiverList from './LienWaiverList';

export default function DrawRequestDetail({ drawId, onClose, canReview = false }) {
  const [draw, setDraw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm1140, setShowForm1140] = useState(false);
  const [refreshWaivers, setRefreshWaivers] = useState(0);
  
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
            <div className="space-y-4">
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
            <button
              onClick={() => setShowForm1140(true)}
              className="px-2 py-1 bg-blue-600 text-white rounded"
            >
              Generate Compliance Form
            </button>
          </div>

          <div>
            <h4 className="font-medium">Status History</h4>
            <DrawStatusTracker drawId={drawId} />
          </div>

          <LienWaiverForm
            drawId={drawId}
            onUploaded={() => setRefreshWaivers(r => r + 1)}
          />
          <LienWaiverList filter={{ draw_id: drawId, refresh: refreshWaivers }} />   
        </div>
      )}
      
      {showForm1140 && (
        <Form1140Stepper drawId={drawId} onClose={() => setShowForm1140(false)} />
      )}
    </DetailDrawer>
  );
}
