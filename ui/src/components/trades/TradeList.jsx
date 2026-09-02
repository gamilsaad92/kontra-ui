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
                 {trade.trade_type} – Notional: {trade.notional_amount} Qty: {trade.quantity} @ {trade.price}
                </span>
                                {Array.isArray(trade.compliance_flags) && trade.compliance_flags.length > 0 && (
                  <ul className="text-xs text-amber-700 list-disc list-inside mt-1">
                    {trade.compliance_flags.map((flag, index) => (
                      <li key={`${trade.id}-flag-${index}`}>
                        ⚠️ {flag.message || flag.code || 'Compliance notice'}
                      </li>
                    ))}
                  </ul>
                )}
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
