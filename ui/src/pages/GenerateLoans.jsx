import React, { useState } from 'react';
import { generateLoans } from '../api/loans';

export default function GenerateLoans() {
  const [count, setCount] = useState(10);
  const [message, setMessage] = useState('');

  const handleGenerate = async () => {
    setMessage('Generating loans…');
    try {
      const inserted = await generateLoans(count);
      setMessage(`Inserted ${inserted} loans`);
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Generate Demo Loans</h1>
      <div className="flex items-center space-x-2">
        <input
          type="number"
          value={count}
          min="1"
          onChange={e => setCount(e.target.value)}
          className="border p-2 rounded w-24 text-black"
        />
        <button
          onClick={handleGenerate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded"
        >
          Generate
        </button>
      </div>
      {message && <p>{message}</p>}
    </div>
  );
}
