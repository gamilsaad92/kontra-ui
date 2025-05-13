import React, { useState, useEffect } from 'react';
import PhotoValidation from './PhotoValidation';
import DrawCard from './components/DrawCard';

export default function App() {
  const [formData, setFormData] = useState({
    project: '',
    project_number: '',
    property_location: '',
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
      fetchDraws();
      setFormData({ project: '', project_number: '', property_location: '', amount: '', description: '' });
    } catch {
      setMessage('Failed to submit');
    }
  };

  const fetchDraws = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/get-draws`);
      const data = await res.json();
      setDraws(data.draws || []);
    } catch {
      setError('Failed to load draw requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDraws(); }, []);

  const handleDrawAction = (action, id, comment) => {
    // implement approve/reject API calls here
    console.log(action, id, comment);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Top Section: two panels side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Draw Submission Form */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Submit Draw Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              name="project"
              placeholder="Project Name"
              value={formData.project}
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />
            <input
              name="project_number"
              placeholder="Project #"
              value={formData.project_number}
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />
            <input
              name="property_location"
              placeholder="Property Location"
              value={formData.property_location}
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />
            <input
              name="amount"
              type="number"
              placeholder="Amount"
              value={formData.amount}
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg"
            />
            <textarea
              name="description"
              placeholder="Description"
              value={formData.description}
              onChange={handleChange}
              required
              className="w-full border p-3 rounded-lg h-24"
            />
            <button
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg mt-4"
            >
              Submit
            </button>
            {message && <p className="mt-3 text-green-600 font-medium">{message}</p>}
          </form>
        </div>

        {/* AI Photo Validation */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <PhotoValidation />
        </div>
      </div>

      {/* Draw Requests List */}
      <div className="mt-10 space-y-6">
        {loading ? (
          <p className="text-center text-gray-500">Loading draw requests...</p>
        ) : error ? (
          <p className="text-center text-red-500">{error}</p>
        ) : draws.length === 0 ? (
          <p className="text-center text-gray-500">No draw requests yet.</p>
        ) : (
          draws.map((draw) => (
            <DrawCard
              key={draw.id}
              draw={draw}
              isAdmin={true}
              onAction={handleDrawAction}
            />
          ))
        )}
      </div>
    </div>
  );
}
