import React, { useState } from 'react';

const sampleInstallments = [
  { date: '2024-01-01', amount: 1000, status: 'paid', method: 'ACH', paidDate: '2024-01-03' },
  { date: '2024-02-01', amount: 1000, status: 'paid', method: 'ACH', paidDate: '2024-02-28' },
  { date: '2024-03-01', amount: 1000, status: 'unpaid', method: '—' },
  { date: '2024-04-01', amount: 1000, status: 'unpaid', method: '—' },
  { date: '2024-05-01', amount: 1000, status: 'unpaid', method: '—' }
];

function isAnomalous(i) {
  const due = new Date(i.date);
  if (i.status === 'paid' && i.paidDate) {
    const paid = new Date(i.paidDate);
    return (paid - due) / (1000 * 60 * 60 * 24) > 7; // paid over a week late
  }
  if (i.status === 'unpaid') {
    return new Date() - due > 7 * 24 * 60 * 60 * 1000; // overdue by a week
  }
  return false;
}

export default function InstallmentsTable() {
  const [filters, setFilters] = useState({ status: '', date: '' });

  const filtered = sampleInstallments.filter(i => {
    return (
      (!filters.status || i.status === filters.status) &&
      (!filters.date || i.date === filters.date)
    );
  });

  return (
    <div className="bg-white rounded-lg shadow-md p-4 space-y-4">
      <div className="flex space-x-2">
        <select
          className="border p-1"
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Any Status</option>
          <option value="paid">paid</option>
          <option value="unpaid">unpaid</option>
        </select>
        <input
          type="date"
          className="border p-1"
          value={filters.date}
          onChange={e => setFilters({ ...filters, date: e.target.value })}
        />
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2">Date</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
            <th className="p-2">Method</th>
            <th className="p-2">AI</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((ins, idx) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{ins.date}</td>
              <td className="p-2">${'{'}ins.amount.toLocaleString()}{'}'}</td>
              <td className="p-2">{ins.status}</td>
              <td className="p-2">{ins.method}</td>
              <td className="p-2">
                {isAnomalous(ins) && <span title="Off schedule">⚠️</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
