import React, { useState } from 'react';
import { API_BASE } from '../lib/apiBase';

export default function SelfServeDrawRequestForm() {
  const [formData, setFormData] = useState({
    project: '',
    project_number: '',
    property_location: '',
    amount: '',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');

  const validate = data => {
    const e = {};
    if (!data.project) e.project = 'Project is required';
    if (!data.project_number) e.project_number = 'Project # required';
    if (!data.property_location) e.property_location = 'Location required';
    if (!data.amount || parseFloat(data.amount) <= 0) e.amount = 'Enter amount';
    if (!data.description) e.description = 'Description required';
    return e;
  };

  const handleChange = e => {
    const next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);
    setErrors(validate(next));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate(formData);
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setMessage('Submitting…');
    try {
      const res = await fetch(`${API_BASE}/api/draw-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Draw request submitted!');
        setFormData({ project: '', project_number: '', property_location: '', amount: '', description: '' });
      } else {
        setMessage(data.message || 'Submission failed');
      }
    } catch {
      setMessage('Failed to submit');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold mb-4">Request a Draw</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input name="project" placeholder="Project Name" value={formData.project} onChange={handleChange} className="w-full border p-2 rounded" />
        {errors.project && <p className="text-red-600 text-sm">{errors.project}</p>}
        <input name="project_number" placeholder="Project #" value={formData.project_number} onChange={handleChange} className="w-full border p-2 rounded" />
        {errors.project_number && <p className="text-red-600 text-sm">{errors.project_number}</p>}
        <input name="property_location" placeholder="Property Location" value={formData.property_location} onChange={handleChange} className="w-full border p-2 rounded" />
        {errors.property_location && <p className="text-red-600 text-sm">{errors.property_location}</p>}
        <input name="amount" type="number" placeholder="Amount" value={formData.amount} onChange={handleChange} className="w-full border p-2 rounded" />
        {errors.amount && <p className="text-red-600 text-sm">{errors.amount}</p>}
        <textarea name="description" placeholder="Description" value={formData.description} onChange={handleChange} className="w-full border p-2 rounded h-24" />
        {errors.description && <p className="text-red-600 text-sm">{errors.description}</p>}
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded">Submit</button>
      </form>
      {message && <p className="mt-3 text-green-600">{message}</p>}
    </div>
  );
}
