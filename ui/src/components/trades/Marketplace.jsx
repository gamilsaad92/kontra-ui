import React, { useState } from 'react';

export default function Marketplace({ entries = [], onSubmitted }) {
  const [type, setType] = useState('bid');
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    await fetch('/api/marketplace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        symbol,
        quantity: Number(quantity),
        price: Number(price)
      })
    });
    setType('bid');
    setSymbol('');
    setQuantity('');
    setPrice('');
    onSubmitted && onSubmitted();
  };

  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">Investor Marketplace</h2>
      <form onSubmit={handleSubmit} className="space-y-2 mb-4">
        <select
          aria-label="Entry Type"
          value={type}
          onChange={e => setType(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="bid">Bid</option>
          <option value="ask">Ask</option>
        </select>
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
        <input
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="Price"
          className="border p-2 rounded w-full"
        />
        <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
          Submit
        </button>
      </form>
      {entries.length === 0 ? (
        <p className="text-gray-500">No entries</p>
      ) : (
        <ul className="space-y-2">
          {entries.map(e => (
            <li key={e.id} className="p-2 border rounded flex justify-between">
              <span>{e.type} {e.symbol} {e.quantity} @ {e.price}</span>
              <span className="text-sm text-gray-600">{e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
