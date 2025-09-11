import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

const KycCheck: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'approved' | 'pending' | 'failed'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/compliance/kyc`)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setStatus(data.status || 'pending');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  let message = 'Checking KYC…';
  if (status === 'approved') message = 'KYC verified';
  else if (status === 'pending') message = 'KYC pending';
  else if (status === 'failed') message = 'KYC check failed';

  return (
    <div className="bg-slate-100 border border-slate-200 rounded p-2 text-sm">
      {message}
    </div>
  );
};

export default KycCheck;
