import React from 'react';
import DelinquencyChart from '../../components/DelinquencyChart';
import Card from '../../components/Card';

export default function DelinquencyCard({ to }) {
  return (
      <Card title="Delinquency Forecast" to={to}>
      <DelinquencyChart />
    </Card>
  );
}
