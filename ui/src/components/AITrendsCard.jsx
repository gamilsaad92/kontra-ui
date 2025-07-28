import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';

export default function AITrendsCard() {
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState({ upcoming: null, highRisk: 0 });

  useEffect(() => {
    async function load() {
      try {
        const [nextRes, recRes] = await Promise.all([
          fetch(`${API_BASE}/api/next-due`).then(r => r.json()),
          fetch(`${API_BASE}/api/recommendations`).then(r => r.json())
        ]);
        setTrend({
          upcoming: nextRes.next_due ? nextRes.next_due.due_date : null,
          highRisk: Array.isArray(recRes.at_risk_loans) ? recRes.at_risk_loans.length : 0
        });
      } catch {
        setTrend({ upcoming: null, highRisk: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card title="AI Trends" loading={loading}>
      <ul className="text-sm space-y-1">
        {trend.upcoming && <li>Next repayment due {trend.upcoming}</li>}
        <li>{trend.highRisk} high-risk loans detected</li>
      </ul>
    </Card>
  );
}
