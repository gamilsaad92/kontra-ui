import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between bg-gray-900 border-b border-gray-700 p-4">
      <h1 className="text-xl font-bold text-white">Dashboard</h1>
      <input
        type="text"
        placeholder="Search…"
        className="px-3 py-1 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
      />
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-white"
        >
          U
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-40 bg-gray-700 rounded shadow-lg">
            <Link to="/profile" className="block px-3 py-2 hover:bg-gray-600">Profile</Link>
            <Link to="/logout" className="block px-3 py-2 hover:bg-gray-600">Logout</Link>
          </div>
        )}  
      </div>
    </header>
  );
}
