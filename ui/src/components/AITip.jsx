import React from 'react';

const tips = [
  'Consider automatic payments to avoid late fees.',
  'Review your loan terms regularly for refinancing opportunities.',
  'Building a solid payment history helps improve your risk profile.',
];

export default function AITip() {
  const tip = tips[Math.floor(Math.random() * tips.length)];
  return (
    <div className="p-4 bg-purple-100 text-purple-800 rounded">
      \u{1F4A1} {tip}
    </div>
  );
}
