import React from 'react';
import GuestOccupancyChart from '../../components/GuestOccupancyChart';

export default function GuestOccupancyCard() {
  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Guest Occupancy</h3>
      <GuestOccupancyChart />
    </div>
  );
}
