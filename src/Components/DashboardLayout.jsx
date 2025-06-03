// DashboardLayout.jsx

import React, { useState, useContext } from 'react';
import { useMediaQuery } from 'react-responsive';

import PhotoValidation from './PhotoValidation';
import DrawRequestsTable from './DrawRequestsTable';
import DrawRequestForm from './DrawRequestForm';
import LienWaiverForm from './LienWaiverForm';
import LienWaiverList from './LienWaiverList';
import CreateLoanForm from './CreateLoanForm';
import LoanList from './LoanList';
import AmortizationTable from './AmortizationTable';
import PaymentForm from './PaymentForm';
import VirtualAssistant from './VirtualAssistant';
import LoginForm from './LoginForm';
import ProjectsTable from './ProjectsTable';
import ProjectForm from './ProjectForm';
import NotificationsList from './NotificationsList';
import AnalyticsDashboard from './AnalyticsDashboard';

import { AuthContext } from '../main';

const navItems = [
  { label: 'Draw Requests',    icon: '📄' },
  { label: 'Photo Validation', icon: '📷' },
  { label: 'Lien Waivers',     icon: '📝' },
  { label: 'Loans',            icon: '💰' },
  { label: 'Assistant',        icon: '🤖' },
  { label: 'Projects',         icon: '🏗️' },
  { label: 'Analytics',        icon: '📊' }
];

export default function DashboardLayout() {
  const { session } = useContext(AuthContext);
  const [active, setActive] = useState('Draw Requests');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);

  // Redirect to login if not authenticated
  if (!session) {
    return <LoginForm />;
  }

  const isMobile = useMediaQuery({ query: '(max-width: 768px)' });
  const [menuOpen, setMenuOpen] = useState(false);

  // Helper to render sidebar items
  const renderNavItems = () =>
    navItems.map(item => (
      <button
        key={item.label}
        onClick={() => {
          setActive(item.label);
          if (isMobile) setMenuOpen(false);
          // Reset selectedId when switching tabs
          setSelectedId(null);
          // Optionally reset refreshKey if you want data to refetch
          setRefreshKey(k => k + 1);
        }}
        className={`w-full text-left mb-4 p-2 rounded hover:bg-gray-700 ${
          active === item.label ? 'bg-gray-700' : ''
        }`}
      >
        {item.icon} {item.label}
      </button>
    ));

  // Sidebar JSX (desktop)
  const DesktopSidebar = (
    <aside className="w-64 bg-gray-800 text-white p-6">
      <h1 className="text-2xl font-bold mb-8">Kontra</h1>
      <nav>{renderNavItems()}</nav>
    </aside>
  );

  // Sidebar JSX (mobile slide-in)
  const MobileSidebar = (
    <aside className="fixed inset-0 bg-black bg-opacity-50 z-20">
      <div className="w-64 bg-gray-800 text-white p-6 h-full">
        <button
          onClick={() => setMenuOpen(false)}
          className="text-white text-xl mb-6"
        >
          ✕
        </button>
        <h1 className="text-2xl font-bold mb-8">Kontra</h1>
        <nav>{renderNavItems()}</nav>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-100">
      {isMobile ? (
        <>
          <button
            onClick={() => setMenuOpen(true)}
            className="p-4 bg-gray-800 text-white fixed top-4 left-4 z-30 rounded"
          >
            ☰
          </button>
          {menuOpen && MobileSidebar}
        </>
      ) : (
        DesktopSidebar
      )}

      <main className="flex-1 p-8 overflow-auto ml-0 md:ml-64">
        {/* Top Header (Notifications, etc.) */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">{active}</h2>
          <NotificationsList />
        </div>

        {/* Content Panels */}
        {active === 'Draw Requests' && (
          <>
            <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />
            <DrawRequestsTable
              key={refreshKey}
              onSelect={id => {
                setSelectedId(id);
                setActive('Lien Waivers');
              }}
            />
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
            <p className="text-gray-500">Select a draw first</p>
          )
        )}

        {active === 'Loans' && (
          selectedId ? (
            <>
              <h3 className="text-xl font-semibold mb-4">Loan Details #{selectedId}</h3>
              <AmortizationTable loanId={selectedId} />
              <PaymentForm
                loanId={selectedId}
                onPaid={() => setRefreshKey(k => k + 1)}
              />
            </>
          ) : (
            <>
              <CreateLoanForm onCreated={() => setRefreshKey(k => k + 1)} />
              <LoanList
                key={refreshKey}
                onSelect={id => {
                  setSelectedId(id);
                  setActive('Loans');
                }}
              />
            </>
          )
        )}

        {active === 'Assistant' && (
          <div className="h-full flex flex-col">
            <VirtualAssistant />
          </div>
        )}

        {active === 'Projects' && (
          selectedId ? (
            <>
              <h3 className="text-xl font-semibold mb-4">Project #{selectedId}</h3>
              <ProjectsTable
                key={refreshKey}
                onSelect={id => setSelectedId(id)}
              />
            </>
          ) : (
            <>
              <ProjectForm onCreated={() => setRefreshKey(k => k + 1)} />
              <ProjectsTable
                key={refreshKey}
                onSelect={id => {
                  setSelectedId(id);
                  setActive('Projects');
                }}
              />
            </>
          )
        )}

        {active === 'Analytics' && <AnalyticsDashboard />}
      </main>
    </div>
  );
}
