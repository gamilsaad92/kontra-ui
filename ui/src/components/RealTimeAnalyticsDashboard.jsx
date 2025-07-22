import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';

export default function RealTimeAnalyticsDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/analytics/stream`);
    es.onmessage = evt => {
      try {
        setData(JSON.parse(evt.data));
      } catch {
        // ignore bad messages
      }
    };
    return () => es.close();
  }, []);

  return (
    <Card title="Real-Time Analytics" loading={!data}>
      {data && (
        <div className="space-y-1">
          <div>Total Orders: {data.totalOrders}</div>
          <div>Total Revenue: ${data.totalRevenue}</div>
        </div>
      )}
    </Card>
  );
}
