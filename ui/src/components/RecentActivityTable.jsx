import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function RecentActivityTable() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/loans`);
        const { loans } = await res.json();
        setLoans(loans.slice(0, 5));
      } catch {
        setLoans([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <p>Loading…</p>;
  if (loans.length === 0) return <p>No recent activity.</p>;

  return (
    <table className="w-full text-left">
      <thead className="bg-gray-100">
        <tr>
          <th className="p-2">Loan</th>
          <th className="p-2">Borrower</th>
          <th className="p-2">Amount</th>
          <th className="p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {loans.map(l => (
          <tr key={l.id} className="border-b last:border-0">
            <td className="p-2">{l.id}</td>
            <td className="p-2">{l.borrower_name}</td>
            <td className="p-2">{l.amount}</td>
            <td className="p-2">
              <span className="px-2 py-1 text-sm rounded bg-blue-100">{l.status}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
