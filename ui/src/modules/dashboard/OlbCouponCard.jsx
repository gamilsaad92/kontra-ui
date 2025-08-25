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
        const data = await res.json();
        setCoupon(data.coupon);
      } catch {
        setCoupon(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card title="OLB Coupon" loading={loading} to={to}>
      {coupon !== null ? (
        <p className="text-xl">{coupon}</p>
      ) : (
        <p>Unable to compute coupon.</p>
      )}
    </Card>
  );
}
