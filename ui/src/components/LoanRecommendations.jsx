import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LoanRecommendations({ loanId }) {
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      setLoading(true);
      try {
        const detailRes = await fetch(`${API_BASE}/api/loans/${loanId}/details`);
        const detailData = await detailRes.json();
        if (!detailRes.ok || !detailData.loan) throw new Error('Missing loan');
        const payload = {
          borrower: { name: detailData.loan.borrower_name, creditScore: detailData.loan.credit_score },
          loan: {
            amount: detailData.loan.amount,
            interest_rate: detailData.loan.interest_rate,
            term_months: detailData.loan.term_months,
            status: detailData.loan.status
          }
        };
        const recRes = await fetch(`${API_BASE}/api/loan-recommendations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const recData = await recRes.json();
        if (recRes.ok && recData.recommendation) setRecommendation(recData.recommendation);
        else setRecommendation('');
      } catch {
        setRecommendation('');
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  if (!loanId) return null;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-400 p-2 rounded">
      {loading ? (
        <p className="text-sm">Loading recommendation…</p>
      ) : recommendation ? (
        <p className="text-sm text-gray-700">{recommendation}</p>
      ) : (
        <p className="text-sm text-gray-700">No recommendation available.</p>
      )}
    </div>
  );
}
