import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';
import Card from '../../components/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function NextDueCard({ to }) {
  const [next, setNext] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/next-due`);
        const { next_due } = await res.json();
        setNext(next_due);
      } catch {
        setNext(null);
      }
    })();
  }, []);

  const chartData = next ? [{ name: 'due', days: next.days_until }] : [];

  return (
   <Card title="Your Next Due Date" to={to}>
      {next ? <p className="text-lg mb-2">{next.due_date}</p> : <p>No upcoming dues.</p>}
      {chartData.length > 0 && (
        <BarChart width={200} height={120} data={chartData} className="mx-auto">
          <XAxis dataKey="name" hide />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="days" fill="#8884d8" />
        </BarChart>
      )}
    </Card>
  );
}
