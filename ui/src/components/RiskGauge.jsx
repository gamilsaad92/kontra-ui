import React from 'react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';

export default function RiskGauge({ value = 0 }) {
  const data = [{ name: 'score', value }];
  return (
    <RadialBarChart
      width={200}
      height={200}
      cx="50%"
      cy="50%"
      innerRadius="80%"
      outerRadius="100%"
      data={data}
      startAngle={180}
      endAngle={0}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
      <RadialBar background clockWise dataKey="value" fill="#8884d8" />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        className="text-2xl font-bold"
      >
        {value}
      </text>
    </RadialBarChart>
  );
}
