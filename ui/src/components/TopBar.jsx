import React, { useState } from 'react';

export default function TopBar({ title }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex items-center justify-between border-b border-gray-700 p-4">
      <h1 className="text-xl font-bold text-white">{title}</h1>
      <div className="flex items-center space-x-4">
        <input
          type="text"
          placeholder="Search..."
          className="px-3 py-1 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none"
        />
        <div className="relative">
          <button
            onClick={() => setOpen(o => !o)}
            className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center"
          >
            U
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-40 bg-gray-700 rounded shadow-lg">
              <a href="#" className="block px-3 py-2 hover:bg-gray-600">Profile</a>
              <a href="#" className="block px-3 py-2 hover:bg-gray-600">Logout</a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
