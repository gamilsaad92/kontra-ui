import React, { useState } from 'react';

export default function BulkActionTable({ rows = [], columns = [] }) {
  const [selected, setSelected] = useState([]);

  const toggle = id => {
    setSelected(s =>
      s.includes(id) ? s.filter(i => i !== id) : [...s, id]
    );
  };

  const approveAll = () => {
    setSelected([]);
    alert('Approved ' + rows.length + ' items');
  };

  const exportCsv = () => {
    const header = columns.join(',');
    const csv = rows.map(r => columns.map(c => r[c]).join(',')).join('\n');
    const blob = new Blob([header + '\n' + csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendReminders = () => {
    alert('Sent reminders to ' + selected.length + ' items');
  };

  return (
    <div className="bg-white rounded shadow">
      <div className="p-2 space-x-2">
        <button className="bg-green-600 text-white px-2 py-1 rounded" onClick={approveAll}>Approve All</button>
        <button className="bg-blue-600 text-white px-2 py-1 rounded" onClick={exportCsv}>Export CSV</button>
        <button className="bg-purple-600 text-white px-2 py-1 rounded" onClick={sendReminders}>Send Reminder Email</button>
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2"></th>
            {columns.map(c => (
              <th key={c} className="p-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-50">
              <td className="p-2 text-center">
                <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggle(r.id)} />
              </td>
              {columns.map(c => (
                <td key={c} className="p-2">{r[c]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
