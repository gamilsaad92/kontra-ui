import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function ReportBuilder() {
  const [table, setTable] = useState('');
  const [fields, setFields] = useState('*');
  const [filters, setFilters] = useState('{}');
  const [rows, setRows] = useState([]);
  const [format, setFormat] = useState('json');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const run = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
          fields,
          filters: JSON.parse(filters || '{}'),
          format
        })
      });
      if (format === 'pdf') {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.open(url);
      } else {
        const data = await res.json();
        setRows(data.rows || []);
      }
    } catch (err) {
      setMessage('Failed to run report');
    }
  };

  const schedule = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          table,
          fields,
          filters: JSON.parse(filters || '{}')
        })
      });
      if (res.ok) setMessage('Scheduled');
      else setMessage('Failed to schedule');
    } catch {
      setMessage('Failed to schedule');
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Ad Hoc Report</h3>
      <input
        className="border p-2 rounded w-full"
        placeholder="table"
        value={table}
        onChange={e => setTable(e.target.value)}
      />
      <input
        className="border p-2 rounded w-full"
        placeholder="fields"
        value={fields}
        onChange={e => setFields(e.target.value)}
      />
      <textarea
        className="border p-2 rounded w-full"
        rows="3"
        placeholder="filters JSON"
        value={filters}
        onChange={e => setFilters(e.target.value)}
      />
      <div className="space-x-2">
        <select
          className="border p-2 rounded"
          value={format}
          onChange={e => setFormat(e.target.value)}
        >
          <option value="json">JSON</option>
          <option value="pdf">PDF</option>
        </select>
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={run}>
          Run
        </button>
      </div>
      <div className="space-x-2">
        <input
          className="border p-2 rounded"
          placeholder="email for schedule"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={schedule}>
          Schedule Daily
        </button>
      </div>
      {rows.length > 0 && (
        <pre className="bg-gray-100 p-2 overflow-auto text-xs">
          {JSON.stringify(rows, null, 2)}
        </pre>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}
