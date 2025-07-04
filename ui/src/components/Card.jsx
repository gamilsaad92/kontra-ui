import React from 'react';

export default function Card({ title, footer, loading = false, children }) {
  return (
    <div className="bg-white rounded shadow p-4 h-full flex flex-col">
      {title && <h3 className="font-bold mb-2">{title}</h3>}
      <div className="flex-1">
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          children
        )}
      </div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
