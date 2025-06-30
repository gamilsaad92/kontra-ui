import React from 'react';
import DelinquencyChart from 'import DelinquencyChart from '../../components/DelinquencyChart';

export default function DelinquencyCard() {
  return (
    <div className="bg-white rounded shadow p-4 h-full">
      <h3 className="font-bold mb-2">Delinquency Forecast</h3>
      <DelinquencyChart />
    </div>
  );
}
