import React from 'react';
import GuestOccupancyChart from '../../components/GuestOccupancyChart';
import Card from '../../components/Card';

export default function GuestOccupancyCard({ to }) {
  return (
     <Card title="Guest Occupancy" to={to}>
      <GuestOccupancyChart />
      </Card>
  );
}
