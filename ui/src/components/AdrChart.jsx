import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const sample = [
  { day: 'Mon', adr: 120 },
  { day: 'Tue', adr: 122 },
  { day: 'Wed', adr: 121 },
  { day: 'Thu', adr: 124 },
  { day: 'Fri', adr: 130 },
  { day: 'Sat', adr: 135 },
  { day: 'Sun', adr: 133 }
];

export default function AdrChart({ data = sample }) {
  return (
    <LineChart width={600} height={200} data={data} className="mx-auto">
      <XAxis dataKey="day" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="adr" stroke="#82ca9d" />
    </LineChart>
  );
}
