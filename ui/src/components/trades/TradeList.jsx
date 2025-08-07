import React from 'react';

export default function TradeList({ trades = [], title }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {trades.length === 0 ? (
        <p className="text-gray-500">No trades</p>
      ) : (
        <ul className="space-y-2">
          {trades.map(trade => (
            <li key={trade.id} className="p-2 border rounded flex justify-between">
              <span>{trade.symbol}</span>
              <span>{trade.quantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
