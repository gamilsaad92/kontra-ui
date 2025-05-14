import React, { useState } from 'react';
import PhotoValidation from '../PhotoValidation';
import LienWaiverForm from './LienWaiverForm';
import DrawRequestsTable from './DrawRequestsTable';

const navItems = [
  { label: 'Draw Requests', icon: '📄' },
  { label: 'Photo Validation', icon: '📷' },
  { label: 'Lien Waivers', icon: '📝' },
  { label: 'Projects', icon: '🏗️' }
];

export default function DashboardLayout() {
  const [active, setActive] = useState('Draw Requests');

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-64 bg-gray-800 text-white p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">Kontra</h1>
        {navItems.map(item => (
          <button
            key={item.label}
            onClick={() => setActive(item.label)}
            className={`w-full text-left mb-4 flex items-center p-2 rounded-lg hover:bg-gray-700 ${
              active === item.label ? 'bg-gray-700' : ''
            }`}
          >
            <span className="mr-3 text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </aside>

      <main className="flex-1 p-8 overflow-auto">
        <h2 className="text-3xl font-bold mb-6">{active}</h2>
        {active === 'Draw Requests' && <DrawRequestsTable />}
        {active === 'Photo Validation' && <PhotoValidation />}
        {active === 'Lien Waivers' && <LienWaiverForm />}
        {active === 'Projects' && <p className="text-gray-500">Projects section coming soon...</p>}
      </main>
    </div>
  );
}
