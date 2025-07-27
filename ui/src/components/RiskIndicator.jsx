import React from 'react';

export default function RiskIndicator({ score }) {
  if (score == null) return null;
  let color = 'bg-green-500';
  if (score > 0.7) color = 'bg-red-500';
  else if (score > 0.4) color = 'bg-yellow-500';
  return <span className={`inline-block w-3 h-3 rounded-full ${color}`} title={`Risk ${score}`}></span>;
}
