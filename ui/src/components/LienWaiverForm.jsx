// src/components/LienWaiverForm.jsx

import React, { useState } from 'react';

export default function LienWaiverForm({ drawId, onUploaded }) {
  const [contractor, setContractor] = useState('');
  const [waiverType, setWaiverType] = useState('');
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = e => {
    setFile(e.target.files[0]);
    setMessage('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!contractor || !waiverType || !file) {
      setMessage('All fields are required');
      return;
    }
    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('draw_id', drawId);
    formData.append('contractor_name', contractor);
    formData.append('waiver_type', waiverType);
    formData.append('file', file);

    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload-lien-waiver`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Waiver uploaded successfully');
        onUploaded(data.data);
        setContractor('');
        setWaiverType('');
        setFile(null);
      } else {
        setMessage(data.message || 'Upload failed');
      }
    } catch {
      setMessage('Error uploading waiver');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-semibold mb-4">Upload Lien Waiver (Draw #{drawId})</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Contractor Name"
          value={contractor}
          onChange={e => setContractor(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Waiver Type"
          value={waiverType}
          onChange={e => setWaiverType(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={handleFileChange}
          className="w-full"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
        >
          {loading ? 'Uploading…' : 'Upload Waiver'}
        </button>
      </form>
      {message && <p className="mt-3 text-gray-700">{message}</p>}
    </div>
  );
}
