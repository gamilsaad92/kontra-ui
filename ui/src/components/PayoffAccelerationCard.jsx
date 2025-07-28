import React, { useState } from 'react';

export default function PayoffAccelerationCard() {
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState(null);

  const calculate = () => {
    const extraVal = parseFloat(extra);
    if (!extraVal || extraVal <= 0) return setResult(null);
    // Dummy calculation
    const interestSaved = (extraVal * 12 * 5).toFixed(2);
    const monthsSaved = Math.round(extraVal / 100);
    setResult({ interestSaved, monthsSaved });
  };

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative space-y-2 text-xs">
      <h3 className="font-semibold">Payoff Acceleration</h3>
      <input
        className="border p-1 rounded w-full"
        placeholder="Extra Monthly Payment"
        value={extra}
        onChange={e => setExtra(e.target.value)}
        type="number"
      />
      <button className="px-2 py-1 bg-blue-600 text-white rounded" onClick={calculate}>Calculate</button>
      {result && (
        <div className="space-y-1">
          <p>Interest Saved: ${result.interestSaved}</p>
          <p>Months Saved: {result.monthsSaved}</p>
          <p>Interest Saved: ${result.interestSaved}</p>
        </div>
      )}
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
