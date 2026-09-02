import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function OlbCouponPage() {
  const [occupancy, setOccupancy] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/olb-coupon?occupancy=${encodeURIComponent(occupancy)}`);
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">OLB Coupon</h1>
      <form onSubmit={handleSubmit} className="space-y-2 max-w-sm">
        <input
          type="number"
          className="border p-2 w-full"
          placeholder="Occupancy rate"
          value={occupancy}
          onChange={e => setOccupancy(e.target.value)}
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={loading}>
          {loading ? 'Loading...' : 'Calculate'}
        </button>
      </form>
      {result && !loading && (
        <div>
          <p>Coupon: {result.coupon}</p>
        </div>
      )}
    </div>
  );
}
