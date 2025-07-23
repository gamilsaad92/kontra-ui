import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function DrawRequestForm({ onSubmitted }) {
  const [formData, setFormData] = useState({
    project: '',
    draw_number: '',
    description: '',
    amount: ''  
  });
   const [files, setFiles] = useState([]);
  const [message, setMessage] = useState('');

  const handleChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFiles = e => {
    setFiles(Array.from(e.target.files));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('Submitting…');
    try {
       const body = new FormData();
      Object.entries(formData).forEach(([k, v]) => body.append(k, v));
      files.forEach(f => body.append('documents', f));
      const res = await fetch(`${API_BASE}/api/draw-requests`, {
        method: 'POST',
        body
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Draw request submitted!');
        onSubmitted && onSubmitted(data.draw?.id);
        setFormData({ project: '', draw_number: '', description: '', amount: '' });
        setFiles([]);
      } else {
        setMessage(data.message || 'Submission failed');
      }
    } catch {
      setMessage('Failed to submit');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Submit Draw Request</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="project"
                placeholder="Project"
          value={formData.project}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
         name="draw_number"
          placeholder="Draw Number"
          value={formData.draw_number}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <input
          name="amount"
          type="number"
          placeholder="Amount"
          value={formData.amount}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded"
        />
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded h-24"
        />
       <input
          type="file"
          accept="application/pdf,image/*"
          multiple
          onChange={handleFiles}
          className="w-full"
        />
        <button
          type="submit"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded"
        >
          Submit
        </button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
