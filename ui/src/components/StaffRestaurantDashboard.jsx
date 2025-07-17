import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import QRCodeDisplay from './QRCodeDisplay';

export default function StaffRestaurantDashboard() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});

  const load = async () => {
    const o = await fetch(`${API_BASE}/api/orders`).then(r => r.json());
    setOrders(o.orders || []);
    const a = await fetch(`${API_BASE}/api/analytics/orders`).then(r => r.json());
    setStats(a);
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
      </div>
    </div>
  );
}
