import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import SmartCard from './SmartCard';

export default function CollectionsTable({ refresh }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/collections`);
        const { collections } = await res.json();
        setRows(collections || []);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]);

  if (loading) return <p>Loading collections…</p>;
  if (rows.length === 0) return <p>No collection items.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Loan</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Due</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
            {rows.map(r => {
            const pastDue =
              r.due_date && new Date(r.due_date) < new Date() && r.status !== 'paid';
            return (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="p-2">{r.loan_id}</td>
                  <td className="p-2">{r.amount}</td>
                  <td className="p-2">{r.due_date}</td>
                  <td className="p-2">{r.status}</td>
                </tr>
                {pastDue && (
                  <tr>
                    <td colSpan="4">
                      <SmartCard message="Borrower has past late payments. Consider tightening terms or adding collateral." />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
