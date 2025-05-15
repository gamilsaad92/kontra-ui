import React, { useState } from 'react';

export default function CreateLoanForm({ onCreated }) {
  const [form, setForm] = useState({ borrower_name: '', amount: '', interest_rate: '', term_months: '', start_date: '' });
  const [msg, setMsg] = useState('');

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  const handleSubmit = async e => {
    e.preventDefault();
    setMsg('Creating...');
    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/loans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    if (res.ok) {
      setMsg('✅ Loan created'); onCreated();
      setForm({ borrower_name: '', amount: '', interest_rate: '', term_months: '', start_date: '' });
    } else {
      const err = await res.json(); setMsg(err.message || 'Error');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-xl font-semibold mb-4">New Loan Origination</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="borrower_name" placeholder="Borrower Name" value={form.borrower_name} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input name="amount" type="number" placeholder="Amount" value={form.amount} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input name="interest_rate" type="number" step="0.01" placeholder="Interest Rate (%)" value={form.interest_rate} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input name="term_months" type="number" placeholder="Term (months)" value={form.term_months} onChange={handleChange} required className="w-full border p-2 rounded" />
        <input name="start_date" type="date" value={form.start_date} onChange={handleChange} required className="w-full border p-2 rounded" />
        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded">Create Loan</button>
        {msg && <p className="mt-2 text-green-600">{msg}</p>}
      </form>
    </div>
  );
}