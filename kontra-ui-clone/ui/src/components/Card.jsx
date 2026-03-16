import React from 'react';
import { Link } from 'react-router-dom';

export default function Card({ title, footer, loading = false, children, to }) {
  const body = (
    <div className="bg-white rounded shadow p-4 h-full flex flex-col hover:bg-gray-50">
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
   return to ? <Link to={to} className="block cursor-pointer">{body}</Link> : body;
}
