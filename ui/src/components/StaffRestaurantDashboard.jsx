import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function StaffRestaurantDashboard() {
  const [stats, setStats] = useState({});
  const [metrics, setMetrics] = useState({});
  
  const load = async () => {
    const a = await fetch(`${API_BASE}/api/analytics/orders`).then(r => r.json());
    setStats(a);
    const m = await fetch(`${API_BASE}/api/analytics/restaurant`).then(r => r.json());
    setMetrics(m);
  };

  useEffect(() => { load(); }, []);

  return (
        <div className="space-y-6">
      <h3 className="text-xl font-bold">Restaurant Metrics</h3>
      <div className="border-t pt-4">        
        <p>Total orders: {stats.totalOrders || 0}</p>
        <p>Total revenue: ${stats.totalRevenue || 0}</p>
                <p>Avg table turnover: {metrics.tableTurnover || 0}</p>
        <p>Avg payment time: {metrics.avgPaymentTimeMinutes} mins</p>
        <p>Avg tip %: {metrics.avgTipPercent}</p>
        <button
          className="mt-2 bg-blue-600 text-white px-3 py-1 rounded"
          onClick={() =>
            (window.location.href = `${API_BASE}/api/accounting/entries?format=csv`)
          }
        >
          Export Accounting
        </button>
      </div>
    </div>
  );
}
