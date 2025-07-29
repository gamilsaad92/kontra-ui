import React from 'react';
import { useRole } from '../lib/roles';
import RiskScoreCard from '../modules/dashboard/RiskScoreCard';
import DelinquencyCard from '../modules/dashboard/DelinquencyCard';
import RecentActivityCard from '../modules/dashboard/RecentActivityCard';
import NextDueCard from '../modules/dashboard/NextDueCard';
import GuestOccupancyCard from '../modules/dashboard/GuestOccupancyCard';
import OfferCard from '../modules/dashboard/OfferCard';
import RoleKpiCard from '../modules/dashboard/RoleKpiCard';
import PortfolioMetricsCard from '../modules/dashboard/PortfolioMetricsCard';

export default function DashboardHome() {
  const role = useRole();
   
 return (
    <div className="space-y-6">
     <h1 className="text-2xl font-bold">Dashboard</h1>

    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">  
      <RoleKpiCard />
        <PortfolioMetricsCard />
        <RiskScoreCard to="/assets?sort=risk" />
        <DelinquencyCard to="/collections?status=delinquent" />
        <NextDueCard to="/payments?next=1" />
        <RecentActivityCard to="/projects?sort=recent" />
        <GuestOccupancyCard to="/guest-reservations" />
        <OfferCard to="/offers" />
      </div>
    </div>
  );
}
