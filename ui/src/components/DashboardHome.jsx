import React, { useState } from 'react';
import { useRole } from '../lib/roles';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';
import NextDueCard from '../modules/dashboard/NextDueCard';
import GuestOccupancyCard from '../modules/dashboard/GuestOccupancyCard';
import OfferCard from '../modules/dashboard/OfferCard';
import DrawRequestForm from './DrawRequestForm';
import DrawStatusTracker from './DrawStatusTracker';
import DrawRequestsTable from './DrawRequestsTable';
import InspectionList from './InspectionList';
import { API_BASE } from '../lib/apiBase';

export default function DashboardHome() {
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
      const res = await fetch(`${API_BASE}/api/draw-requests/${lastId}/summary?email=${encodeURIComponent(email)}`);
      if (res.ok) setMsg('Email sent');
      else setMsg('Failed to send');
    } catch {
      setMsg('Failed to send');
    }
  };
   
 return (
    <div className="space-y-6">
     <h1 className="text-2xl font-bold">Dashboard</h1>
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
            <button onClick={downloadSummary} className="px-2 py-1 bg-blue-600 text-white rounded">Generate Draw Summary PDF</button>
            <div className="flex space-x-2">
              <input
                className="border p-1 flex-1"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button onClick={shareSummary} className="px-2 py-1 bg-green-600 text-white rounded">Share</button>
            </div>
            {msg && <p className="text-sm">{msg}</p>}
          </div>
        </>
      )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <RiskScoreCard />
        <DelinquencyCard />
        <NextDueCard />
        <RecentActivityCard />
        <GuestOccupancyCard />
        <OfferCard />
      </div>
    </div>
  );
}
