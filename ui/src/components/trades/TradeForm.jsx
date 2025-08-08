import React, { useState } from 'react';

export default function TradeForm({ onSubmitted }) {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [side, setSide] = useState('buy');
  const [counterparties, setCounterparties] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol,
        quantity: Number(quantity),
        price: Number(price),
        side,
        counterparties: counterparties
          .split(',')
          .map(c => c.trim())
          .filter(Boolean)
      })
    });
    setSymbol('');
    setQuantity('');
    setPrice('');
    setSide('buy');
    setCounterparties('');
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
            <input
        value={price}
        onChange={e => setPrice(e.target.value)}
        placeholder="Price"
        className="border p-2 rounded w-full"
      />
      <select
        value={side}
        onChange={e => setSide(e.target.value)}
        className="border p-2 rounded w-full"
      >
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      <input
        value={counterparties}
        onChange={e => setCounterparties(e.target.value)}
        placeholder="Counterparties (comma separated)"
        className="border p-2 rounded w-full"
      />
      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
        Submit Trade
      </button>
    </form>
  );
}
