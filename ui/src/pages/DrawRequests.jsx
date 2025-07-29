import React, { useState } from 'react';
import { useRole } from '../lib/roles';
import DrawRequestForm from '../components/DrawRequestForm';
import DrawRequestsTable from '../components/DrawRequestsTable';
import DrawStatusTracker from '../components/DrawStatusTracker';
import InspectionList from '../components/InspectionList';
import { API_BASE } from '../lib/apiBase';

export default function DrawRequests() {
  const role = useRole();
  const [lastId, setLastId] = useState(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  const downloadSummary = () => {
    if (!lastId) return;
    window.open(`${API_BASE}/api/draw-requests/${lastId}/summary`, '_blank');
  };

  const shareSummary = async () => {
    if (!lastId || !email) return;
    setMsg('Sending...');
    try {
      const res = await fetch(
        `${API_BASE}/api/draw-requests/${lastId}/summary?email=${encodeURIComponent(email)}`
      );
      if (res.ok) setMsg('Email sent');
      else setMsg('Failed to send');
    } catch {
      setMsg('Failed to send');
    }
  };

  return (
    <div className="space-y-6">
      {(role === 'borrower' || role === 'admin') && (
        <DrawRequestForm onSubmitted={id => setLastId(id)} />
      )}
      {(role === 'lender' || role === 'admin') && (
        <DrawRequestsTable onSelect={id => setLastId(id)} canReview />
      )}
      {role === 'inspector' && <InspectionList />}
      {lastId && (role === 'borrower' || role === 'admin') && (
        <>
          <DrawStatusTracker drawId={lastId} />
          <div className="space-y-2 mt-2">
            <button
              onClick={downloadSummary}
              className="px-2 py-1 bg-blue-600 text-white rounded"
            >
              Generate Draw Summary PDF
            </button>
            <div className="flex space-x-2">
              <input
                className="border p-1 flex-1"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button
                onClick={shareSummary}
                className="px-2 py-1 bg-green-600 text-white rounded"
              >
                Share
              </button>
            </div>
            {msg && <p className="text-sm">{msg}</p>}
          </div>
        </>
      )}
    </div>
  );
}
