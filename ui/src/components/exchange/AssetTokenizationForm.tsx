import React, { useState } from 'react';
import { API_BASE } from '../../lib/apiBase';

const AssetTokenizationForm: React.FC = () => {
  const [asset, setAsset] = useState('');
  const [supply, setSupply] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
 const [tokenId, setTokenId] = useState<string | null>(null);
  const [error, setError] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('pending');
    try {
     const res = await fetch(`${API_BASE}/exchange/tokenize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset, supply: Number(supply) })
      });
            const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tokenization failed');
      setTokenId(data.token?.id || null);
      setStatus('success');
      setAsset('');
      setSupply('');
      setError('');
    } catch (err: any) {
      setError(err.message || 'Tokenization failed');
      setStatus('error');
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h2 className="text-xl font-semibold mb-2">Asset Tokenization</h2>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          className="border p-2 rounded w-full"
          placeholder="Asset name"
          value={asset}
          onChange={(e) => setAsset(e.target.value)}
        />
        <input
          className="border p-2 rounded w-full"
          placeholder="Total supply"
          value={supply}
          onChange={(e) => setSupply(e.target.value)}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Tokenize
        </button>
      </form>
      {status === 'pending' && (
        <p className="text-sm text-gray-500 mt-2">Submitting...</p>
      )}
      {status === 'success' && tokenId && (
        <p className="text-sm text-green-600 mt-2">Token created with ID {tokenId}</p>
      )}
      {status === 'error' && (
         <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
};

export default AssetTokenizationForm;
