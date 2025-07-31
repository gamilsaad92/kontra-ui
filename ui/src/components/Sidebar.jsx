import React from 'react';
import { Link } from 'react-router-dom';

const links = [
  { label: 'Dashboard', to: '/' },
  { label: 'Land Acquisition', to: '/land-acquisition' },
  { label: 'Market Analysis', to: '/market-analysis' },
  { label: 'Settings', to: '/settings' },
];

export default function Sidebar() {
  return (
       <div className="w-64 h-screen bg-gray-800 text-white flex flex-col">
      <div className="p-4 text-2xl font-bold border-b border-gray-700">Kontra</div>
      <nav className="flex-1 p-4 space-y-2">
        {links.map(link => (
         <Link key={link.to} to={link.to} className="block px-3 py-2 rounded hover:bg-gray-700">
            {link.label}
          </Link>
        ))}
      </nav>
   </div>
 );
}
