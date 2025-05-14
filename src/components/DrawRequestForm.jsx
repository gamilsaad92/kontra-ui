import React, { useState } from 'react';

export default function DrawRequestForm({ onSubmitted }) {
  const [formData, setFormData] = useState({
    project: '',
    project_number: '',
    property_location: '',
    amount: '',
    description: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) =>
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Submitting...');
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/draw-request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      );
      const data = await res.json();
      setMessage(data.message || 'Submitted!');
      setFormData({
        project: '',
        project_number: '',
        property_location: '',
        amount: '',
        description: ''
      });
      onSubmitted();       // let parent know
    } catch {
      setMessage('Error');
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-xl font-semibold mb-4">New Draw Request</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {['project','project_number','property_location','amount'].map(name => (
          <input
            key={name}
            name={name}
            type={name==='amount'?'number':'text'}
            placeholder={name.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase())}
            value={formData[name]}
            onChange={handleChange}
            required
            className="w-full border p-2 rounded"
          />
        ))}
        <textarea
          name="description"
          placeholder="Description"
          value={formData.description}
          onChange={handleChange}
          required
          className="w-full border p-2 rounded h-20"
        />
        <button
          type="submit"
          className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded"
        >
          Submit
        </button>
        {message && <p className="mt-2 text-green-600">{message}</p>}
      </form>
    </div>
  );
}
