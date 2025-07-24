import React, { useEffect, useState } from 'react';
import RecentActivityTable from '../../components/RecentActivityTable';
import Card from '../../components/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function RecentActivityCard({ to }) {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
      const t = setTimeout(() => {
      setEvents([
        'Project ABC draw approved',
        'Occupancy hit 90%'
      ]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(t);
  }, []);

    const chartData = events.map((e, i) => ({ name: i + 1, value: i + 1 }));

  return (
     <Card title="Recent Activity" loading={loading} to={to}>
      <ul className="list-disc list-inside text-sm space-y-1 mb-2">
        {events.map((e, i) => (
          <li key={i}>{e}</li>
        ))}
      </ul>
      {chartData.length > 0 && (
        <BarChart width={200} height={120} data={chartData} className="mx-auto">
          <XAxis dataKey="name" hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#8884d8" />
        </BarChart>
      )}
    </Card>      
  );
}
