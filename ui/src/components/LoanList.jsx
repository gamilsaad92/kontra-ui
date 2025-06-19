// src/components/LoanList.jsx

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function LoanList({ onSelect }) {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans`);
        const { loans } = await res.json();
        setLoans(loans || []);
      } catch {
        // ignore errors here
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading loans…</p>;
  if (loans.length === 0) return <p>No loans found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">ID</th>
            <th className="p-2">Borrower</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
            <th className="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {loans.map(loan => (
            <tr
              key={loan.id}
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelect(loan.id)}
            >
              <td className="p-2">{loan.id}</td>
              <td className="p-2">{loan.borrower_name}</td>
              <td className="p-2">${loan.amount}</td>
              <td className="p-2">{loan.status || '—'}</td>
              <td className="p-2">{new Date(loan.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
