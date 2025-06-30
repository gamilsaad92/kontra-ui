import React from 'react';
import RiskGauge from '../../components/RiskGauge';

export default function RiskScoreCard({ value = 72 }) {
  return (
    <div className="bg-white rounded shadow p-4 flex items-center justify-center h-full">
      <RiskGauge value={value} />
    </div>
  );
}
