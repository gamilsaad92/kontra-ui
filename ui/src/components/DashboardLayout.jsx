import React, { useState, useContext, useEffect } from 'react';
import { AuthContext }    from '../main';
import LoginForm          from './LoginForm';
import SignUpForm         from './SignUpForm';
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
import ProjectForm        from './ProjectForm';
import ProjectsTable      from './ProjectsTable';
import ProjectDetail      from './ProjectDetail';
import AnalyticsDashboard from './AnalyticsDashboard';
import LoanApplicationForm from './LoanApplicationForm';
import LoanApplicationList from './LoanApplicationList';
import UnderwritingBoard   from './UnderwritingBoard';
import EscrowDashboard    from './EscrowDashboard';
import CollectionForm     from './CollectionForm';
import CollectionsTable   from './CollectionsTable';
import InvestorReportForm from './InvestorReportForm';
import InvestorReportsList from './InvestorReportsList';
import AssetForm          from './AssetForm';
import AssetsTable        from './AssetsTable';

function sortByUsage(items, counts) {
  return [...items].sort((a, b) => (counts[b.label] || 0) - (counts[a.label] || 0));
}

// Nav items arranged with optional submenus
const navItems = [
  {
    label: 'Applications',
    icon: '📝',
    sub: ['New Application', 'Application List']
  },
  {
    label: 'Loans',
    icon: '💰',
    sub: ['Create Loan', 'Loan List']
  },
  {
    label: 'Draw Requests',
    icon: '📄',
    sub: ['New Request', 'Request List']
  },
  { label: 'Escrows', icon: '🏦' },
  { label: 'Collections', icon: '📬' },
  { label: 'Investor Reports', icon: '📑' },
  { label: 'Assets', icon: '🏘️' },
  { label: 'Projects',         icon: '🏗️' },
  { label: 'Photo Validation', icon: '📷' },
  { label: 'Assistant',        icon: '🤖' },
  { label: 'Analytics',        icon: '📊' },
  { label: 'Underwriting Board', icon: '✅' }
];

export default function DashboardLayout() {
  // Start on the loan list view by default
  const [active, setActive] = useState('Loan List');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const { session, supabase } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);
  const [expanded, setExpanded] = useState({ Applications: true, Loans: true });
  const [usage, setUsage] = useState({});
  const [orderedNav, setOrderedNav] = useState(navItems);
  const [lastSwitchTime, setLastSwitchTime] = useState(Date.now());

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('navUsage') || '{}');
    setUsage(stored);
    setOrderedNav(sortByUsage(navItems, stored));
    setLastSwitchTime(Date.now());
    return () => {
      const now = Date.now();
      const latest = JSON.parse(localStorage.getItem('navUsage') || '{}');
      latest[active] = (latest[active] || 0) + (now - lastSwitchTime);
      localStorage.setItem('navUsage', JSON.stringify(latest));
    };
  }, []);
  
  const toggleMenu = (label) => {
    setExpanded((e) => ({ ...e, [label]: !e[label] }));
  };

  const activate = (label) => {
    const now = Date.now();
    const updated = { ...usage };
    updated[active] = (updated[active] || 0) + (now - lastSwitchTime);
    setUsage(updated);
    localStorage.setItem('navUsage', JSON.stringify(updated));
    setOrderedNav(sortByUsage(navItems, updated));
    setLastSwitchTime(now);
    setActive(label);
    if (
      label !== 'Request List' &&
      label !== 'Loan List' &&
      label !== 'Application List'
    ) {
      setSelectedId(null);
    }
    if (label !== 'Projects') {
      setSelectedProjectId(null);
    }
  };

  if (!session) {
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar navigation */}
      <aside className="w-64 bg-gray-800 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-gray-700">Kontra</div>
        <nav className="flex-1 overflow-auto p-2">
          {orderedNav.map((item) => (
            <div key={item.label} className="mb-1">
              {item.sub ? (
                <>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-gray-700"
                  >
                    <span>
                      {item.icon} {item.label}
                    </span>
                    <span>{expanded[item.label] ? '▾' : '▸'}</span>
                  </button>
                  {expanded[item.label] && (
                    <div className="ml-4 mt-1 space-y-1">
                      {item.sub.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => activate(sub)}
                          className={`block w-full text-left px-3 py-1 rounded hover:bg-gray-700 ${
                            active === sub ? 'bg-gray-700' : ''
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={() => activate(item.label)}
                  className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 ${
                    active === item.label ? 'bg-gray-700' : ''
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              )}
            </div>
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="p-4 border-t border-gray-700 hover:bg-gray-700 text-left"
        >
          Log Out
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <h2 className="text-3xl font-bold mb-6">{active}</h2>
        
 {active === 'New Application' && (
          <LoanApplicationForm onSubmitted={() => setRefreshKey((k) => k + 1)} />
        )}

        {active === 'Application List' && (
          <LoanApplicationList key={refreshKey} />
        )}
        {active === 'New Request' && (
          <DrawRequestForm onSubmitted={() => setRefreshKey((k) => k + 1)} />
        )}

        {active === 'Request List' && (
          <>
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

        {active === 'Create Loan' && (
          <CreateLoanForm onCreated={() => setRefreshKey((k) => k + 1)} />
        )}

        {active === 'Loan List' && (
          selectedId ? (
            <>
              <h3 className="text-xl mb-4">Loan Details #{selectedId}</h3>
              <AmortizationTable loanId={selectedId} />
              <PaymentForm
                loanId={selectedId}
                onSubmit={() => setRefreshKey((k) => k + 1)}
              />
            </>
          ) : (
            <LoanList key={refreshKey} onSelect={setSelectedId} />
          )
        )}

        {active === 'Assistant' && (
          <div className="h-full flex flex-col border rounded-lg bg-white">
            <VirtualAssistant />
          </div>
        )}

        {active === 'Collections' && (
          <>
            <CollectionForm onCreated={() => setRefreshKey(k => k + 1)} />
            <CollectionsTable refresh={refreshKey} />
          </>
        )}

        {active === 'Investor Reports' && (
          <>
            <InvestorReportForm onCreated={() => setRefreshKey(k => k + 1)} />
            <InvestorReportsList refresh={refreshKey} />
          </>
        )}

        {active === 'Assets' && (
          <>
            <AssetForm onCreated={() => setRefreshKey(k => k + 1)} />
            <AssetsTable refresh={refreshKey} />
          </>
        )}
        
        {active === 'Escrows' && <EscrowDashboard />}
        
        {active === 'Projects' && (
          selectedProjectId ? (
            <>
              <button
                onClick={() => setSelectedProjectId(null)}
                className="mb-4 text-blue-600 underline"
              >
                ← Back to Projects
              </button>
              <ProjectDetail projectId={selectedProjectId} />
            </>
          ) : (
            <>
              <ProjectForm onCreated={() => setProjectRefreshKey((k) => k + 1)} />
              <ProjectsTable
                key={projectRefreshKey}
                onSelect={setSelectedProjectId}
              />
            </>
          )
        )}

        {active === 'Analytics' && <AnalyticsDashboard />}
        
        {active === 'Underwriting Board' && <UnderwritingBoard />}
      </main>
    </div>
  );
}
