import React from 'react';
import RiskGauge from './RiskGauge';
import DelinquencyChart from './DelinquencyChart';
import RecentActivityTable from './RecentActivityTable';
import GuestOccupancyChart from './GuestOccupancyChart';

export default function DashboardHome() {
  return (
    <div className="grid gap-6 grid-cols-2">
      <div className="bg-white rounded shadow p-4 flex items-center justify-center">
        <RiskGauge value={72} />
      </div>
      <div className="bg-white rounded shadow p-4">
        <h3 className="font-bold mb-2">Delinquency Forecast</h3>
        <DelinquencyChart />
      </div>
      <div className="bg-white rounded shadow p-4 col-span-2">
        <h3 className="font-bold mb-2">Recent Activity</h3>
        <RecentActivityTable />
      </div>
      <div className="bg-white rounded shadow p-4 col-span-2">
        <h3 className="font-bold mb-2">Guest Occupancy</h3>
        <GuestOccupancyChart />
      </div>
    </div>
  );
}
