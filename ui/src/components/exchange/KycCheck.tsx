import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';
import { isFeatureEnabled } from '../../lib/featureFlags';

const KycCheck: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'approved' | 'pending' | 'failed'>('loading');
 const complianceEnabled = isFeatureEnabled('compliance');
  
  useEffect(() => {
        if (!complianceEnabled) {
      return;
    }

    let cancelled = false;
   fetch(`${API_BASE}/api/kyc`)
      .then(res => {
        if (!res.ok) throw new Error(`status ${res.status}`);
        return res.json();
      })
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
  }, [complianceEnabled]);

  if (!complianceEnabled) {
    return (
      <div className="bg-slate-100 border border-slate-200 rounded p-2 text-sm">
        KYC automation not enabled
      </div>
    );
  }

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
