import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const sample = [
  { day: 'Mon', occupancy: 70 },
  { day: 'Tue', occupancy: 75 },
  { day: 'Wed', occupancy: 72 },
  { day: 'Thu', occupancy: 78 },
  { day: 'Fri', occupancy: 85 },
  { day: 'Sat', occupancy: 90 },
  { day: 'Sun', occupancy: 88 }
];

export default function GuestOccupancyChart({ data = sample }) {
  return (
    <LineChart width={600} height={200} data={data} className="mx-auto">
      <XAxis dataKey="day" />
      <YAxis domain={[0, 100]} />
      <Tooltip />
      <Line type="monotone" dataKey="occupancy" stroke="#8884d8" />
    </LineChart>
  );
}
