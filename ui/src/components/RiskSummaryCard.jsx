import React, { useEffect, useState } from 'react';

export default function RiskSummaryCard({ riskSummary }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      if (riskSummary) return setData(riskSummary);
      // simulate fetch
      const result = await new Promise(resolve =>
        setTimeout(
          () =>
            resolve({
              loanClasses: ['A', 'B', 'C'],
              score: 72,
              level: 'Medium',
              recommendations: ['Refinance high rate loans', 'Review collateral']
            }),
          300
        )
      );
      setData(result);
    }
    load();
  }, [riskSummary]);

  if (!data) {
    return (
      <div className="bg-white border rounded-lg shadow-sm p-4">Loading...</div>
    );
  }

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 relative space-y-2">
      <h3 className="font-semibold text-sm">Search by natural language</h3>
      <div className="text-xs space-y-1">
        <div className="flex justify-between">
          <span className="font-medium">Loan Classes:</span>
          <span>{data.loanClasses.join(', ')}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Risk Score:</span>
          <span>{data.score}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Risk Level:</span>
          <span>{data.level}</span>
        </div>
        <select className="w-full border rounded p-1 text-xs mt-1">
          {['Low', 'Medium', 'High'].map(r => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <ul className="list-disc pl-4 mt-2 space-y-1">
          {data.recommendations.map((rec, i) => (
            <li key={i}>{rec}</li>
          ))}
        </ul>
      </div>
      <button className="absolute bottom-2 right-2 bg-purple-600 text-white text-xs rounded-full px-2 py-1">AI</button>
    </div>
  );
}
