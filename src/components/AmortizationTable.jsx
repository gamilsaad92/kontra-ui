import React, { useState, useEffect } from 'react';
export default function AmortizationTable({ loanId }) {
  const [schedule, setSchedule] = useState([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/loans/${loanId}/schedule`)
      .then(r => r.json()).then(d => setSchedule(d.schedule));
  }, [loanId]);

  return (
    <table className="min-w-full bg-white rounded shadow">
      <thead className="bg-gray-200"><tr>
        {['Due Date','Principal','Interest','Balance'].map(h=><th key={h} className="px-4 py-2">{h}</th>)}
      </tr></thead>
      <tbody>
        {schedule.map(s=>(
          <tr key={s.id} className="border-t">
            <td className="px-4 py-2">{s.due_date}</td>
            <td className="px-4 py-2">{s.principal_due.toFixed(2)}</td>
            <td className="px-4 py-2">{s.interest_due.toFixed(2)}</td>
            <td className="px-4 py-2">{s.balance_after.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}