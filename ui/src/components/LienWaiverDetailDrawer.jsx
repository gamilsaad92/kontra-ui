import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { DetailDrawer } from './ui';

export default function LienWaiverDetailDrawer({ waiverId, onClose }) {
  const [waiver, setWaiver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!waiverId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/lien-waivers/${waiverId}`);
        const data = await res.json();
        if (res.ok) setWaiver(data.waiver);
      } catch {
        setWaiver(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [waiverId]);

  return (
    <DetailDrawer open={!!waiverId} onClose={onClose}>
      {loading && <p>Loading…</p>}
      {!loading && !waiver && <p>Not found.</p>}
      {!loading && waiver && (
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Lien Waiver #{waiver.id}</h3>
          <p>Contractor: {waiver.contractor_name}</p>
          <p>Type: {waiver.waiver_type}</p>
          <p>Status: {waiver.verification_passed ? 'Verified' : 'Failed'}</p>
        </div>
      )}
    </DetailDrawer>
  );
}
