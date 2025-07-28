import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import Card from './Card';

export default function PortfolioOverviewStats() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({ avgBalance: 0, avgRate: 0, count: 0 });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE}/api/loans`);
        const data = await res.json();
        const loans = Array.isArray(data.loans) ? data.loans : [];
        const count = loans.length;
        if (count) {
          const totalBalance = loans.reduce((s, l) => s + parseFloat(l.amount || 0), 0);
          const totalRate = loans.reduce((s, l) => s + parseFloat(l.interest_rate || 0), 0);
          setMetrics({
            avgBalance: totalBalance / count,
            avgRate: totalRate / count,
            count
          });
        } else {
          setMetrics({ avgBalance: 0, avgRate: 0, count: 0 });
        }
      } catch {
        setMetrics({ avgBalance: 0, avgRate: 0, count: 0 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <Card title="Portfolio Metrics" loading={loading}>
      <div className="text-sm space-y-1">
        <p>Average Balance: ${metrics.avgBalance.toFixed(2)}</p>
        <p>Average Rate: {metrics.avgRate.toFixed(2)}%</p>
        <p>Number of Loans: {metrics.count}</p>
      </div>
    </Card>
  );
}
