import { useState, useEffect } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function useRiskScore({ loanId, borrowerHistory, paymentHistory, creditData }) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loanId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/risk-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanId, borrowerHistory, paymentHistory, creditData })
    })
      .then(r => r.json())
      .then(d => setScore(d.score))
      .catch(() => setScore(null))
      .finally(() => setLoading(false));
  }, [loanId, borrowerHistory, paymentHistory, creditData]);

  return { score, loading };
}
