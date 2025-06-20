// src/components/AmortizationTable.jsx

import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function AmortizationTable({ loanId }) {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Generate schedule (if not yet generated) - optional to call generate-schedule endpoint
        await fetch(`${API_BASE}/api/loans/${loanId}/generate-schedule`, {
          method: 'POST'
        });
        // Fetch the schedule
        const res = await fetch(`${API_BASE}/api/loans/${loanId}/schedule`);
        const { schedule } = await res.json();
        setSchedule(schedule || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  if (loading) return <p>Loading schedule…</p>;
  if (schedule.length === 0) return <p>No amortization schedule found.</p>;

  return (
    <div className="bg-white rounded-lg shadow-md mb-6">
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Due Date</th>
            <th className="p-2">Principal Due</th>
            <th className="p-2">Interest Due</th>
            <th className="p-2">Balance After</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="p-2">{row.due_date}</td>
              <td className="p-2">{row.principal_due.toFixed(2)}</td>
              <td className="p-2">{row.interest_due.toFixed(2)}</td>
              <td className="p-2">{row.balance_after.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
