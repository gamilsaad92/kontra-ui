import React from 'react';
import { Link } from 'react-router-dom';

export default function Sidebar({ links }) {
  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen flex flex-col">
          <div className="p-4 text-2xl font-bold border-b border-gray-700 text-red-900">K Kontra</div>
      <nav className="flex-1 p-4 space-y-2">
        {links.map(link => (
          <Link
            key={link.label}
            to={link.to}
            className="block px-3 py-2 rounded hover:bg-gray-700"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
