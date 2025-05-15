import React, { useState, useEffect } from 'react';
export default function LoanList() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async ()=>{ const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/loans`); const {loans} = await res.json(); setLoans(loans||[]); setLoading(false); })(); }, []);
  if (loading) return <p>Loading loans...</p>;
  return (
    <ul className="space-y-2">
      {loans.map(l=> (
        <li key={l.id} className="p-2 bg-white shadow rounded">
          #{l.id} {l.borrower_name}: ${l.amount} @ {l.interest_rate}% for {l.term_months}m starting {l.start_date}
        </li>
      ))}
    </ul>
  );
}