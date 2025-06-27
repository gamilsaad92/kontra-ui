import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function PaymentHistory({ loanId }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/payments`);
        const { payments } = await res.json();
        setPayments(payments || []);
      } catch {
        setPayments([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  if (loading) return <p>Loading payments…</p>;
  if (!payments.length) return <p>No payments found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md mb-4">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Principal</th>
            <th className="p-2">Interest</th>
            <th className="p-2">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td className="p-2">{p.date}</td>
              <td className="p-2">{p.amount}</td>
              <td className="p-2">{p.applied_principal}</td>
              <td className="p-2">{p.applied_interest}</td>
              <td className="p-2">{p.remaining_balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
