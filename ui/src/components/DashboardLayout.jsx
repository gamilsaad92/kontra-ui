import React, { useState } from 'react';
import PhotoValidation    from './PhotoValidation';
import DrawRequestsTable  from './DrawRequestsTable';
import DrawRequestForm    from './DrawRequestForm';
import LienWaiverForm     from './LienWaiverForm';
import LienWaiverList     from './LienWaiverList';
import InspectionForm     from './InspectionForm';
import InspectionList     from './InspectionList';
import CreateLoanForm     from './CreateLoanForm';
import LoanList           from './LoanList';
import AmortizationTable  from './AmortizationTable';
import PaymentForm        from './PaymentForm';
import VirtualAssistant   from './VirtualAssistant';

// Nav items arranged to reflect common lender operations
const navItems = [
  { label: 'Loans',            icon: '💰' },
  { label: 'Draw Requests',    icon: '📄' },
  { label: 'Photo Validation', icon: '📷' },
  { label: 'Assistant',        icon: '🤖' },
  { label: 'Projects',         icon: '🏗️' }
];

export default function DashboardLayout() {
  // Start on the Loans view by default for lender-centric workflows
  const [active, setActive] = useState('Loans');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Top Navigation */}
      <header className="bg-gray-800 text-white p-4 flex items-center">
        <h1 className="text-2xl font-bold mr-8">Kontra</h1>
        <nav className="flex space-x-4">
          {navItems.map(item => (
            <button
              key={item.label}
              onClick={() => {
                setActive(item.label);
                // Reset selection when switching away from draw/loan views
                if (item.label !== 'Draw Requests' && item.label !== 'Loans') {
                  setSelectedId(null);
                }
              }}
              className={`px-3 py-1 rounded hover:bg-gray-700 ${
                active === item.label ? 'bg-gray-700' : ''
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <h2 className="text-3xl font-bold mb-6">{active}</h2>

        {active === 'Draw Requests' && (
          <>
            <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />
            <DrawRequestsTable key={refreshKey} onSelect={setSelectedId} />
            {selectedId && (
              <>
                <LienWaiverForm drawId={selectedId} />
                <LienWaiverList drawId={selectedId} />
                <InspectionForm drawId={selectedId} />
                <InspectionList drawId={selectedId} />
              </>
            )}
          </>
        )}

        {active === 'Photo Validation' && <PhotoValidation />}


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
