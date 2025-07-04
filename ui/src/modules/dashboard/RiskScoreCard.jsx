import React, { useEffect, useState } from 'react';
import RiskGauge from '../../components/RiskGauge';
import Card from '../../components/Card';

export default function RiskScoreCard({ value = 72 }) {
    const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  return (
      <Card title="Risk Score" loading={loading}>
      <div className="flex items-center justify-center h-full">
        <RiskGauge value={value} />
      </div>
    </Card>
  );
}
