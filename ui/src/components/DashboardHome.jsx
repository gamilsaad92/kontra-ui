import React, { useState } from 'react';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';
import NextDueCard from '../modules/dashboard/NextDueCard';
import GuestOccupancyCard from '../modules/dashboard/GuestOccupancyCard';
import OfferCard from '../modules/dashboard/OfferCard';
import DrawRequestForm from './DrawRequestForm';
import DrawStatusTracker from './DrawStatusTracker';

export default function DashboardHome() {
 const [lastId, setLastId] = useState(null);
   
    return (
    <div className="space-y-6">
         <h1 className="text-2xl font-bold">Dashboard</h1>
      <DrawRequestForm onSubmitted={id => setLastId(id)} />
      {lastId && <DrawStatusTracker drawId={lastId} />}
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
