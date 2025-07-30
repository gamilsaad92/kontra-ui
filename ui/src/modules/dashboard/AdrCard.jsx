import React from 'react';
import Card from '../../components/Card';
import AdrChart from '../../components/AdrChart';

export default function AdrCard({ data, to }) {
  return (
    <Card title="Average Daily Rate" to={to}>
      <AdrChart data={data} />
    </Card>
  );
}
