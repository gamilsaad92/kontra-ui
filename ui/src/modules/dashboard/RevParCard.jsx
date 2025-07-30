import React from 'react';
import Card from '../../components/Card';
import RevParChart from '../../components/RevParChart';

export default function RevParCard({ data, to }) {
  return (
    <Card title="RevPAR" to={to}>
      <RevParChart data={data} />
    </Card>
  );
}
