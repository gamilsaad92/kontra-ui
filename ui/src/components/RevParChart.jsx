import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';

const sample = [
  { day: 'Mon', revpar: 80 },
  { day: 'Tue', revpar: 82 },
  { day: 'Wed', revpar: 81 },
  { day: 'Thu', revpar: 84 },
  { day: 'Fri', revpar: 90 },
  { day: 'Sat', revpar: 95 },
  { day: 'Sun', revpar: 93 }
];

export default function RevParChart({ data = sample }) {
  return (
    <LineChart width={600} height={200} data={data} className="mx-auto">
      <XAxis dataKey="day" />
      <YAxis />
      <Tooltip />
      <Line type="monotone" dataKey="revpar" stroke="#ffc658" />
    </LineChart>
  );
}
