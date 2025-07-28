import React, { useState } from 'react';
import Overview from './Overview';
import Exposure from './Exposure';
import Events from './Events';
import LoanNotes from './LoanNotes';
import AnalyticsOverview from './AnalyticsOverview';
import LoanMaster from './LoanMaster';
import ConsolidatedNotes from './ConsolidatedNotes';
import Installments from './Installments';
import PaymentAnalysis from './PaymentAnalysis';
import AmortizationSchedule from './AmortizationSchedule';
import Servicing from './Servicing';

const tabs = [
  'Overview',
  'Exposure',
  'Events',
  'Loan Notes',
  'Analytics Overview',
  'Loan Master',
  'Consolidated Notes',
  'Installments Due/Paid',
  'Payment Analysis',
  'Amortization Schedule',
  'Servicing'
];

const components = {
  Overview,
  Exposure,
  Events,
  'Loan Notes': LoanNotes,
  'Analytics Overview': AnalyticsOverview,
  'Loan Master': LoanMaster,
  'Consolidated Notes': ConsolidatedNotes,
  'Installments Due/Paid': Installments,
  'Payment Analysis': PaymentAnalysis,
  'Amortization Schedule': AmortizationSchedule,
  Servicing
};

export default function LoanDashboard() {
  const [active, setActive] = useState(tabs[0]);
  const ActiveComponent = components[active];

  return (
    <div className="flex min-h-screen bg-gray-900 text-white">
      <aside className="w-48 border-r border-gray-700 p-2 space-y-1">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setActive(t)}
            className={`block w-full text-left px-3 py-2 rounded hover:bg-gray-700 ${
              active === t ? 'bg-gray-700' : ''
            }`}
          >
            {t}
          </button>
        ))}
      </aside>
      <main className="flex-1 p-4 overflow-auto">
        <ActiveComponent />
      </main>
    </div>
  );
}
