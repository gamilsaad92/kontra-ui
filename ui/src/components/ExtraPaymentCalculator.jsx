import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function ExtraPaymentCalculator({ loanId }) {
  const [loan, setLoan] = useState(null);
  const [extra, setExtra] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/details`);
        const data = await res.json();
        if (res.ok && data.loan) setLoan(data.loan);
        else setLoan(null);
      } catch {
        setLoan(null);
      }
    })();
  }, [loanId]);

  useEffect(() => {
    if (!loan) return setResult(null);
    const extraVal = parseFloat(extra);
    if (!extraVal || extraVal <= 0) return setResult(null);

    const P = parseFloat(loan.amount);
    const r = parseFloat(loan.interest_rate) / 100 / 12;
    const n = parseInt(loan.term_months, 10);
    const payment = (P * r) / (1 - Math.pow(1 + r, -n));

    let balance = P;
    let interestTotal = 0;
    let months = 0;

    while (balance > 0 && months < 1000) {
      const interest = balance * r;
      let principal = payment + extraVal - interest;
      if (principal <= 0) break;
      if (principal > balance) principal = balance;
      balance -= principal;
      interestTotal += interest;
      months += 1;
    }

    const originalInterest = payment * n - P;
    const saved = originalInterest - interestTotal;
    const payoffDate = addMonths(loan.start_date, months);
    setResult({ payoffDate, saved });
  }, [extra, loan]);

  const addMonths = (dateStr, months) => {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="bg-white rounded shadow p-4">
      <h4 className="font-semibold mb-2">Extra Payment Calculator</h4>
      <input
        className="border p-2 w-full mb-2 rounded"
        type="number"
        placeholder="Extra Monthly Payment"
        value={extra}
        onChange={e => setExtra(e.target.value)}
      />
      {result && (
        <div className="text-sm text-gray-700 space-y-1">
          <p>New Payoff Date: {result.payoffDate}</p>
          <p>Interest Saved: ${result.saved.toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}
