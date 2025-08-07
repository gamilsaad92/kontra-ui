import React, { useState } from 'react';

export default function TradeForm({ onSubmitted }) {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, quantity })
    });
    setSymbol('');
    setQuantity('');
    onSubmitted && onSubmitted();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 mb-6">
      <input
        value={symbol}
        onChange={e => setSymbol(e.target.value)}
        placeholder="Symbol"
        className="border p-2 rounded w-full"
      />
      <input
        value={quantity}
        onChange={e => setQuantity(e.target.value)}
        placeholder="Quantity"
        className="border p-2 rounded w-full"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit Trade
      </button>
    </form>
  );
}
