// src/components/CreateLoanForm.jsx

import React, { useState } from 'react';

export default function CreateLoanForm({ onCreated }) {
  const [formData, setFormData] = useState({
    borrower_name: '',
    amount: '',
    interest_rate: '',
    term_months: '',
    start_date: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('Creating loan…');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Loan created successfully');
        onCreated();
        setFormData({ borrower_name: '', amount: '', interest_rate: '', term_months: '', start_date: '' });
      } else {
        setMessage(data.message || 'Creation failed');
      }
    } catch {
      setMessage('Error creating loan');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Create New Loan</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="borrower_name"
          placeholder="Borrower Name"
          value={formData.borrower_name}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="amount"
          type="number"
          placeholder="Loan Amount"
          value={formData.amount}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="interest_rate"
          type="number"
          placeholder="Interest Rate (%)"
          value={formData.interest_rate}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="term_months"
          type="number"
          placeholder="Term (months)"
          value={formData.term_months}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="start_date"
          type="date"
          placeholder="Start Date"
          value={formData.start_date}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded"
        >
          Create Loan
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
