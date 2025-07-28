import React from 'react';

const tips = [
  'Refinancing could lower your monthly payment if rates drop.',
  'Applying extra funds toward principal may shorten your payoff schedule.',
  'Making biweekly payments can reduce interest over time.'
];

export default function AILoanAdvice() {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  return (
    <div className="p-4 bg-purple-100 text-purple-800 rounded">
      {tip}
    </div>
  );
}
