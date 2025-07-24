import React, { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase';
import Card from '../../components/Card';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

export default function OfferCard({ to }) {
  const [offers, setOffers] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/suggest-upsells`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guest_id: 1 })
        });
        const { suggestions } = await res.json();
        setOffers(suggestions || []);
      } catch {
        setOffers([]);
      }
    })();
  }, []);

   const chartData = offers.map((o, i) => ({ name: o, value: 1 }));

  return (
     <Card title="Recommended Offers" to={to}>
      <ul className="list-disc list-inside text-sm space-y-1 mb-2">
        {offers.map((o, i) => (
          <li key={i}>{o}</li>
        ))}
      </ul>
      {chartData.length > 0 && (
        <PieChart width={200} height={120} className="mx-auto">
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={40}>
            {chartData.map((_, idx) => (
              <Cell key={idx} fill={idx % 2 === 0 ? '#8884d8' : '#82ca9d'} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      )}
    </Card>
  );
}
