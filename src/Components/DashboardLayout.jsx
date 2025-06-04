// src/components/DashboardLayout.jsx

import React, { useState } from 'react';
import PhotoValidation    from './PhotoValidation';
import DrawRequestsTable  from './DrawRequestsTable';
import DrawRequestForm    from './DrawRequestForm';
import LienWaiverForm     from './LienWaiverForm';
import LienWaiverList     from './LienWaiverList';
import CreateLoanForm     from './CreateLoanForm';
import LoanList           from './LoanList';
import AmortizationTable  from './AmortizationTable';
import PaymentForm        from './PaymentForm';
import VirtualAssistant   from './VirtualAssistant';

const navItems = [
  { label: 'Draw Requests',    icon: '📄' },
  { label: 'Photo Validation', icon: '📷' },
  { label: 'Lien Waivers',     icon: '📝' },
  { label: 'Loans',            icon: '💰' },
  { label: 'Assistant',        icon: '🤖' },
  { label: 'Projects',         icon: '🏗️' }
];

export default function DashboardLayout() {
  const [active, setActive] = useState('Draw Requests');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-6">
        <h1 className="text-2xl font-bold mb-8">Kontra</h1>
        <nav>
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => {
                setActive(item.label);
                // Reset selection when switching sections
                if (item.label !== 'Lien Waivers' && item.label !== 'Loans') {
                  setSelectedId(null);
                }
              }}
              className={`w-full text-left mb-4 p-2 rounded hover:bg-gray-700 ${
                active === item.label ? 'bg-gray-700' : ''
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <h2 className="text-3xl font-bold mb-6">{active}</h2>

        {active === 'Draw Requests' && (
          <>
            <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />
            <DrawRequestsTable key={refreshKey} onSelect={setSelectedId} />
          </>
        )}

        {active === 'Photo Validation' && <PhotoValidation />}

        {active === 'Lien Waivers' && (
          selectedId ? (
            <>
              <LienWaiverForm drawId={selectedId} />
              <LienWaiverList drawId={selectedId} />
            </>
          ) : (
            <p className="text-gray-500">Select a draw first to manage waivers</p>
          )
        )}

        {active === 'Loans' && (
          selectedId ? (
            <>
              <h3 className="text-xl mb-4">Loan Details #{selectedId}</h3>
              <AmortizationTable loanId={selectedId} />
              <PaymentForm loanId={selectedId} onPaid={() => setRefreshKey(k => k + 1)} />
            </>
          ) : (
            <>
              <CreateLoanForm onCreated={() => setRefreshKey(k => k + 1)} />
              <LoanList key={refreshKey} onSelect={setSelectedId} />
            </>
          )
        )}

        {active === 'Assistant' && (
          <div className="h-full flex flex-col border rounded-lg bg-white">
            <VirtualAssistant />
          </div>
        )}

        {active === 'Projects' && (
          <p className="text-gray-500">Projects section coming soon…</p>
        )}
      </main>
    </div>
  );
}
