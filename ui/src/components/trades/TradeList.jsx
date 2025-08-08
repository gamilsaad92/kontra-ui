import React from 'react';

export default function TradeList({ trades = [], title, onSettle }) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      {trades.length === 0 ? (
        <p className="text-gray-500">No trades</p>
      ) : (
        <ul className="space-y-2">
          {trades.map(trade => (
              <li
              key={trade.id}
              className="p-2 border rounded flex justify-between items-center"
            >
              <div className="flex flex-col">
                <span className="font-medium">{trade.symbol}</span>
                <span className="text-sm text-gray-600">
                  Qty: {trade.quantity} @ {trade.price}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm capitalize">{trade.status}</span>
                {trade.status === 'pending' && onSettle && (
                  <button
                    className="bg-green-500 text-white px-2 py-1 rounded"
                    onClick={() => onSettle(trade.id)}
                  >
                    Settle
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
