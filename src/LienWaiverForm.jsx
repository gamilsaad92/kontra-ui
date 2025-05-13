import React, { useState } from 'react';

export default function LienWaiverForm({ drawId, onUploaded }) {
  const [file, setFile] = useState(null);
  const [contractor, setContractor] = useState('');
  const [type, setType] = useState('conditional');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !contractor) return;
    const form = new FormData();
    form.append('file', file);
    form.append('draw_id', drawId);
    form.append('contractor_name', contractor);
    form.append('waiver_type', type);

    const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/upload-lien-waiver`, {
      method: 'POST',
      body: form
    });
    const data = await res.json();
    setMessage(data.message || 'Uploaded');
    onUploaded(data.data);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-2">
      <input type="text" placeholder="Contractor Name" value={contractor} onChange={e=>setContractor(e.target.value)} required className="w-full border p-1 rounded" />
      <select value={type} onChange={e=>setType(e.target.value)} className="w-full border p-1 rounded">
        <option value="conditional">Conditional</option>
        <option value="unconditional">Unconditional</option>
      </select>
      <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files[0])} required />
      <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Upload Waiver</button>
      {message && <p className="text-sm text-green-600">{message}</p>}
    </form>
}
