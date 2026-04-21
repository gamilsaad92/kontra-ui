import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const sample = [
  { month: 'Jan', delinquency: 2 },
  { month: 'Feb', delinquency: 3 },
  { month: 'Mar', delinquency: 4 },
  { month: 'Apr', delinquency: 3 },
  { month: 'May', delinquency: 5 },
  { month: 'Jun', delinquency: 4 }
];

export default function DelinquencyChart({ data = sample }) {
  return (
    <BarChart width={400} height={200} data={data} className="mx-auto">
      <XAxis dataKey="month" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="delinquency" fill="#82ca9d" />
    </BarChart>
  );
}
