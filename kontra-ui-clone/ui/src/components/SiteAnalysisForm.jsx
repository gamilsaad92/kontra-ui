import React, { useState } from 'react';

export default function SiteAnalysisForm({ onAnalyze }) {
  const [zip, setZip] = useState('');
  const [lotSize, setLotSize] = useState('');
  const [zoning, setZoning] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onAnalyze && onAnalyze({ zip, lotSize, zoning });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        value={zip}
        onChange={e => setZip(e.target.value)}
        placeholder="ZIP Code"
        required
        className="w-full border p-2 rounded"
      />
      <input
        value={lotSize}
        onChange={e => setLotSize(e.target.value)}
        placeholder="Lot Size (sq ft)"
        required
        className="w-full border p-2 rounded"
      />
      <input
        value={zoning}
        onChange={e => setZoning(e.target.value)}
        placeholder="Zoning Type"
        required
        className="w-full border p-2 rounded"
      />
      <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded">
        Analyze Site
      </button>
    </form>
  );
}
