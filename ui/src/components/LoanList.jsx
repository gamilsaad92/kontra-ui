// src/components/LoanList.jsx

import React, { useEffect, useState, useContext } from 'react';
import LoanDetailPanel from './LoanDetailPanel';
import { API_BASE } from '../lib/apiBase';
import { AuthContext } from '../lib/authContext';

export default function LoanList({ onSelect }) {
  const { session } = useContext(AuthContext);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    borrower: '',
    from: '',
    to: '',
    minRisk: '',
    maxRisk: '',
    search: ''
  });
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    if (!session) return;
    fetch(`${API_BASE}/api/saved-loan-queries`, {
      headers: { 'x-user-id': session.user.id }
    })
      .then(r => r.json())
      .then(d => setSaved(d.queries || []));
  }, [session]);
  
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
          if (v) params.append(k, v);
        });
        const res = await fetch(`${API_BASE}/api/loans?${params.toString()}`);
        const { loans } = await res.json();
        setLoans(loans || []);
      } catch {
        // ignore errors here
      } finally {
        setLoading(false);
      }
    })();
    }, [filters]);

  if (loading) return <p>Loading loans…</p>;
  if (loans.length === 0) return <p>No loans found.</p>;

    const toggleSelect = id => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const exportCsv = () => {
    const rows = loans.filter(l => selected.includes(l.id));
    const header = Object.keys(rows[0] || {}).join(',');
    const csv =
      header +
      '\n' +
      rows.map(r => Object.values(r).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'loans.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const changeStatus = async status => {
    await fetch(`${API_BASE}/api/loans/batch-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: selected, status })
    });
    setFilters({ ...filters }); // trigger refresh
  };

    const saveCurrent = async () => {
    if (!session) return;
    const name = prompt('Save filter as:');
    if (!name) return;
    await fetch(`${API_BASE}/api/saved-loan-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': session.user.id
      },
      body: JSON.stringify({ name, query: filters })
    });
    const res = await fetch(`${API_BASE}/api/saved-loan-queries`, {
      headers: { 'x-user-id': session.user.id }
    });
    const d = await res.json();
    setSaved(d.queries || []);
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
           <div className="p-4 space-y-2">
        <div className="flex space-x-2">
          <input
            className="border p-1 flex-1"
            placeholder="Borrower"
            value={filters.borrower}
            onChange={e => setFilters({ ...filters, borrower: e.target.value })}
          />
          <select
            className="border p-1"
            value={filters.status}
            onChange={e => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="">Any Status</option>
            <option value="active">active</option>
            <option value="paid">paid</option>
          </select>
          <input
            type="text"
            className="border p-1"
            placeholder="Search"
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <div className="flex space-x-2">
          <input
            type="date"
            className="border p-1"
            value={filters.from}
            onChange={e => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            type="date"
            className="border p-1"
            value={filters.to}
            onChange={e => setFilters({ ...filters, to: e.target.value })}
          />
          <input
            type="number"
            className="border p-1"
            placeholder="Min Risk"
            value={filters.minRisk}
            onChange={e => setFilters({ ...filters, minRisk: e.target.value })}
          />
          <input
            type="number"
            className="border p-1"
            placeholder="Max Risk"
            value={filters.maxRisk}
            onChange={e => setFilters({ ...filters, maxRisk: e.target.value })}
          />
        </div>
        <div className="flex space-x-2 items-center">
          <select
            className="border p-1"
            onChange={e => {
              const q = saved.find(s => s.id === parseInt(e.target.value, 10));
              if (q) setFilters(q.query_json);
            }}
          >
            <option value="">Load Saved</option>
            {saved.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            onClick={saveCurrent}
            className="px-2 py-1 bg-blue-600 text-white rounded"
          >
            Save Filter
          </button>
        </div>
        {selected.length > 0 && (
          <div className="flex space-x-2 items-center">
            <button
              onClick={() => changeStatus('reminder')}
              className="px-2 py-1 bg-blue-600 text-white rounded"
            >
              Send Reminders
            </button>
            <button
              onClick={exportCsv}
              className="px-2 py-1 bg-green-600 text-white rounded"
            >
              Export CSV
            </button>
            <button
              onClick={() => changeStatus('paid')}
              className="px-2 py-1 bg-purple-600 text-white rounded"
            >
              Mark Paid
            </button>
          </div>
        )}
      </div>
      <table className="w-full text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="p-2"></th>
            <th className="p-2">ID</th>
            <th className="p-2">Borrower</th>
            <th className="p-2">Amount</th>
            <th className="p-2">Status</th>
            <th className="p-2">Created</th>
          </tr>
        </thead>
        <tbody>
          {loans.map(loan => (
            <tr
              key={loan.id}
              className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => {
                setDetailId(loan.id);
                onSelect && onSelect(loan.id);
              }}
              >
                            <td className="p-2" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selected.includes(loan.id)}
                  onChange={() => toggleSelect(loan.id)}
                />
              </td>
              <td className="p-2">{loan.id}</td>
              <td className="p-2">{loan.borrower_name}</td>
               <td className="p-2">{loan.amount}</td>
              <td className="p-2">{loan.status || '—'}</td>
              <td className="p-2">{new Date(loan.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
            {detailId && <LoanDetailPanel loanId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
