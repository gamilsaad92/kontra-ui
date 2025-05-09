import React, { useState, useEffect } from 'react';
import PhotoValidation from './PhotoValidation';
import DrawCard from './components/DrawCard';

export default function App() {
  const [formData, setFormData] = useState({
    project: '',
    amount: '',
    description: ''
  });
  const [message, setMessage] = useState('');
  const [draws, setDraws] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      fetchDraws(); // refresh draw list
      setFormData({ project: '', amount: '', description: '' });
    } catch (err) {
      setMessage('Failed to submit');
    }
  };

  const fetchDraws = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/get-draws`);
      const data = await res.json();
      console.log('🔍 Raw API response:', data);
      setDraws(Array.isArray(data.draws) ? data.draws : []);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load draw requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDraws();
  }, []);

  const handleDrawAction = (action, id, comment) => {
    alert(`${action.toUpperCase()} draw #${id}${comment ? `: ${comment}` : ''}`);
    // Optional: send action to backend
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-8 space-y-10">
      {/* ✅ Submit Form */}
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

      {/* ✅ AI Validation */}
      <PhotoValidation />

      {/* ✅ Draw List */}
      <div className="w-full max-w-2xl space-y-4">
        {loading ? (
          <p className="text-gray-500">Loading draw requests...</p>
        ) : error ? (
          <p className="text-red-500">{error}</p>
        ) : draws.length === 0 ? (
          <p className="text-gray-500">No draw requests yet.</p>
        ) : (
          draws.map((draw, index) =>
            draw?.id ? (
              <DrawCard
                key={draw.id}
                draw={draw}
                isAdmin={true}
                onAction={handleDrawAction}
              />
            ) : (
              <p key={index} className="text-red-500">⚠️ Invalid draw object</p>
            )
          )
        )}
      </div>
    </div>
  );
}
