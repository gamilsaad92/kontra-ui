import React, { useEffect, useState } from 'react';
import { API_BASE } from '../lib/apiBase';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function ReportBuilder() {
  const [name, setName] = useState('');
  const [table, setTable] = useState('');
 const [available, setAvailable] = useState([]);
  const [fields, setFields] = useState([]);
  const [filters, setFilters] = useState('{}');
   const [groupBy, setGroupBy] = useState('');
  const [viz, setViz] = useState('table');
  const [rows, setRows] = useState([]);
  const [email, setEmail] = useState('');
   const [schedule, setSchedule] = useState('daily');
  const [saved, setSaved] = useState([]);
  const [message, setMessage] = useState('');

    useEffect(() => {
    if (!table) return;
    fetch(`${API_BASE}/api/reports/fields?table=${table}`)
      .then(res => res.json())
      .then(data => setAvailable(data.fields || []))
      .catch(() => setAvailable([]));
  }, [table]);

  useEffect(() => {
    fetch(`${API_BASE}/api/reports/saved`)
      .then(res => res.json())
      .then(data => setSaved(data.reports || []));
  }, [message]);

  const run = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table,
                 fields: fields.join(','),
          filters: JSON.parse(filters || '{}'),
                  format: 'json',
          groupBy
        })
      });
          const data = await res.json();
      setRows(data.rows || []);
    } catch (err) {
      setMessage('Failed to run report');
    }
  };

  const save = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, table, fields: fields.join(','), filters: JSON.parse(filters || '{}') })
      });
      if (res.ok) setMessage('Saved');
      else setMessage('Failed to save');
    } catch {
      setMessage('Failed to save');
    }
  };

  const scheduleReport = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/reports/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
         schedule,
          table,
          fields: fields.join(','),
          filters: JSON.parse(filters || '{}')
        })
      });
      if (res.ok) setMessage('Scheduled');
      else setMessage('Failed to schedule');
    } catch {
      setMessage('Failed to schedule');
    }
  };

    const onDragStart = field => e => {
    e.dataTransfer.setData('text/plain', field);
  };

  const onDrop = e => {
    e.preventDefault();
    const field = e.dataTransfer.getData('text/plain');
    if (field && !fields.includes(field)) {
      setFields([...fields, field]);
    }
  };

  const removeField = f => {
    setFields(fields.filter(x => x !== f));
  };

  return (
    <div className="space-y-4">
    <h3 className="text-xl font-bold">Custom Report</h3>
      <div className="space-y-2">
        <input className="border p-2 rounded w-full" placeholder="report name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border p-2 rounded w-full" placeholder="table" value={table} onChange={e => setTable(e.target.value)} />
        <textarea className="border p-2 rounded w-full" rows="2" placeholder="filters JSON" value={filters} onChange={e => setFilters(e.target.value)} />
        <input className="border p-2 rounded w-full" placeholder="group by" value={groupBy} onChange={e => setGroupBy(e.target.value)} />
      </div>
      <div className="flex space-x-4">
        <div className="w-1/2">
          <h4 className="font-semibold">Available Fields</h4>
          <div className="border p-2 min-h-[100px] space-y-1">
            {available.map(f => (
              <div key={f} className="bg-gray-100 p-1 rounded cursor-move" draggable onDragStart={onDragStart(f)}>
                {f}
              </div>
            ))}
          </div>
        </div>
        <div className="w-1/2">
          <h4 className="font-semibold">Selected Fields</h4>
          <div className="border p-2 min-h-[100px] space-y-1" onDragOver={e => e.preventDefault()} onDrop={onDrop}>
            {fields.map(f => (
              <div key={f} className="bg-blue-100 p-1 rounded flex justify-between">
                <span>{f}</span>
                <button onClick={() => removeField(f)}>x</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="space-x-2">
            <select className="border p-2 rounded" value={viz} onChange={e => setViz(e.target.value)}>
          <option value="table">Table</option>
          <option value="bar">Bar</option>  
        </select>
           <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={run}>Run</button>
        <button className="bg-gray-600 text-white px-3 py-1 rounded" onClick={save}>Save</button>
      </div>
      <div className="space-x-2">
                <input className="border p-2 rounded" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <select className="border p-2 rounded" value={schedule} onChange={e => setSchedule(e.target.value)}>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={scheduleReport}>Schedule</button>
      </div>
        {viz === 'table' && rows.length > 0 && (
        <pre className="bg-gray-100 p-2 overflow-auto text-xs">{JSON.stringify(rows, null, 2)}</pre>
      )}
      {viz === 'bar' && rows.length > 0 && groupBy && (
        <BarChart width={400} height={300} data={rows} className="bg-white">
          <XAxis dataKey={groupBy} />
          <YAxis />
          <Tooltip />
          <Bar dataKey={fields[0]} fill="#8884d8" />
        </BarChart>
      )}
      {saved.length > 0 && (
        <div>
          <h4 className="font-semibold">Saved Reports</h4>
          <ul className="list-disc list-inside">
            {saved.map(r => (
              <li key={r.id}>{r.name}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}
