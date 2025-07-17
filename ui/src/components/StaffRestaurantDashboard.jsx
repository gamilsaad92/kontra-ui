import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import QRCodeDisplay from './QRCodeDisplay';

export default function StaffRestaurantDashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [metrics, setMetrics] = useState({});
  
  const load = async () => {
    const o = await fetch(`${API_BASE}/api/orders`).then(r => r.json());
    setOrders(o.orders || []);
    const a = await fetch(`${API_BASE}/api/analytics/orders`).then(r => r.json());
    setStats(a);
    const m = await fetch(`${API_BASE}/api/analytics/restaurant`).then(r => r.json());
    setMetrics(m);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold">Orders</h3>
      <ul className="space-y-2">
        {orders.map(o => (
          <li key={o.id} className="border p-2 rounded">
            <div className="flex justify-between">
              <span>Order #{o.id}</span>
              <span>${o.total}</span>
            </div>
            {o.qr && <QRCodeDisplay data={o.qr} />}
          </li>
        ))}
      </ul>
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
