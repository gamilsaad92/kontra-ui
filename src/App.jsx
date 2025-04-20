import React, { useState } from 'react';
import PhotoValidation from './PhotoValidation';

export default function App() {
  const [formData, setFormData] = useState({
    project: '',
    amount: '',
    description: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Submitting...');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/draw-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      setMessage(data.message || 'Submitted successfully');
    } catch (err) {
      setMessage('Failed to submit');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8">
      <div className="bg-white rounded-xl shadow-md p-6 w-full max-w-xl">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Submit Draw Request</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            className="w-full border p-2 rounded"
            name="project"
            placeholder="Project Name"
            value={formData.project}
            onChange={handleChange}
            required
          />
          <input
            className="w-full border p-2 rounded"
            name="amount"
            type="number"
            placeholder="Amount"
            value={formData.amount}
            onChange={handleChange}
            required
          />
          <textarea
            className="w-full border p-2 rounded"
            name="description"
            placeholder="Description"
            value={formData.description}
            onChange={handleChange}
            required
          />
          <button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded w-full"
          >
            Submit
          </button>
        </form>
        {message && <p className="mt-4 font-medium text-green-700">{message}</p>}
      </div>
      <PhotoValidation />
    </div>
  );
}
