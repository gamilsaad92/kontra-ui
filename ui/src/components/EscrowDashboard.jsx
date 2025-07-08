// src/components/EscrowDashboard.jsx
import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function EscrowDashboard() {
  const [escrows, setEscrows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
       const res = await fetch(`${API_BASE}/api/escrows/upcoming`);
        const { escrows } = await res.json();
        setEscrows(escrows || []);
      } catch {
        // ignore fetch errors in demo
      } finally {
        setLoading(false);
      }
    })();
  }, []);

   const pay = async (loanId, type, amount) => {
    try {
      await fetch(`${API_BASE}/api/loans/${loanId}/escrow/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, amount })
      });
    } catch {
      // ignore errors in demo
    }
  };

  if (loading) return <p>Loading escrows…</p>;
  if (escrows.length === 0) return <p>No escrow accounts found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Loan</th>
            <th className="p-2">Tax Amount</th>
            <th className="p-2">Next Tax Due</th>
            <th className="p-2">Insurance Amount</th>
            <th className="p-2">Next Insurance Due</th>
            <th className="p-2">Projected Balance</th>
          </tr>
        </thead>
        <tbody>
          {escrows.map((e) => (
            <tr key={e.loan_id}>
              <td className="p-2">{e.loan_id}</td>
               <td className="p-2">
                {e.tax_amount}
                <button
                  onClick={() => pay(e.loan_id, 'tax', e.tax_amount)}
                  className="ml-2 text-blue-600 underline"
                >
                  Pay
                </button>
              </td>
              <td className="p-2">{e.next_tax_due}</td>
              <td className="p-2">
                {e.insurance_amount}
                <button
                  onClick={() => pay(e.loan_id, 'insurance', e.insurance_amount)}
                  className="ml-2 text-blue-600 underline"
                >
                  Pay
                </button>
              </td>
              <td className="p-2">{e.next_insurance_due}</td>
              <td className="p-2">{e.projected_balance}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
