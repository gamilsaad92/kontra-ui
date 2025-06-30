import React from 'react';
import RecentActivityTable from '../../components/RecentActivityTable';

export default function RecentActivityCard() {
  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Recent Activity</h3>
      <RecentActivityTable />
    </div>
  );
}
