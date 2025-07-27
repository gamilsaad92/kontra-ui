import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { API_BASE } from '../../lib/apiBase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from 'recharts';

export default function PortfolioMetricsCard({ to }) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/portfolio-metrics`);
        const data = await res.json();
        setMetrics(data);
      } catch {
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const barData = metrics
    ? [
        {
          name: 'Delinquency',
          value: Number((metrics.avgDelinquency * 100).toFixed(2))
        },
        {
          name: 'Risk',
          value: Number((metrics.avgRiskScore * 100).toFixed(2))
        }
      ]
    : [];

  return (
    <Card title="Portfolio Metrics" loading={loading} to={to}>
      {metrics && (
        <>
          <BarChart width={250} height={120} data={barData} className="mx-auto">
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
          {metrics.prepayment && metrics.prepayment.length > 0 && (
            <LineChart
              width={250}
              height={120}
              data={metrics.prepayment}
              className="mx-auto mt-4"
            >
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#82ca9d" />
            </LineChart>
          )}
        </>
      )}
    </Card>
  );
}
