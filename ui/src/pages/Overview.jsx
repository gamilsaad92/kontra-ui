import React, { useEffect, useState } from 'react';
import { fetchLoanSummary } from '../api/loans';
import useMockRiskScore from '../lib/hooks/useMockRiskScore';
import AITip from '../components/AITip';

export default function Overview() {
  const [loan, setLoan] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchLoanSummary();
        setLoan(data);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, []);

  const score = useMockRiskScore(loan?.id);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!loan) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Loan Summary</h1>
      <pre className="bg-white p-4 rounded shadow text-sm overflow-auto">
        {JSON.stringify(loan, null, 2)}
      </pre>
      <p className="text-lg">Risk Score: <span className="font-bold">{score}</span></p>
      <AITip />
    </div>
  );
}
