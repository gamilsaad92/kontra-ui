import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_BASE } from '../../lib/apiBase';

export default function OlbCouponCard({ to }) {
  const [coupon, setCoupon] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/olb-coupon`);
       if (!res.ok) throw new Error('Failed to fetch coupon');
        const data = await res.json();
      setCoupon(typeof data.coupon === 'number' ? data.coupon : null);
      } catch {
        setCoupon(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

    const formatted = coupon !== null ? `${coupon.toFixed(2)}%` : null;

  return (
    <Card title="OLB Coupon" loading={loading} to={to}>
      {formatted ? (
       <p className="text-xl">{formatted}</p>
      ) : (
        <p>Unable to compute coupon.</p>
      )}
    </Card>
  );
}
