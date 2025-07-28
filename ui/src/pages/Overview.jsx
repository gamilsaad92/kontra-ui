import React, { useEffect, useState } from 'react';
import LoanQueryWidget from '../components/LoanQueryWidget';
import useMockAiRiskScore from '../lib/hooks/useMockAiRiskScore';
import AILoanAdvice from '../components/AILoanAdvice';

export default function Overview() {
  const [loan, setLoan] = useState(null);

  useEffect(() => {
      const t = setTimeout(() => {
      setLoan({
        currentBalance: 250000,
        interestRate: 5.25,
        ytdCollected: 15000
      });
    }, 300);
    return () => clearTimeout(t);
  }, []);

const score = useMockAiRiskScore(loan);

  let label = '';
  if (score != null) {
    if (score > 0.7) label = 'High';
    else if (score > 0.4) label = 'Medium';
    else label = 'Low';
  }

  if (!loan || score == null) return <p>Loading...</p>;

  return (
    <div className="space-y-4">
     <LoanQueryWidget />
      <div className="flex items-center space-x-2">
        <p className="font-semibold">AI Risk Score:</p>
        <span>{score.toFixed(2)}</span>
        <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-800 text-xs">{label}</span>
      </div>
      <AILoanAdvice />
      <div className="bg-white text-black p-4 rounded shadow space-y-1">
        <div>Current Balance: ${loan.currentBalance.toLocaleString()}</div>
        <div>Interest Rate: {loan.interestRate}%</div>
        <div>YTD Collected: ${loan.ytdCollected.toLocaleString()}</div>
      </div>
    </div>
  );
}
