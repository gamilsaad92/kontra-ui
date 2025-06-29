import React, { useState, useContext } from 'react';
import { AuthContext } from '../main';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import VirtualAssistant from './VirtualAssistant';
import DashboardHome from './DashboardHome';
import LoanApplicationForm from './LoanApplicationForm';
import LoanApplicationList from './LoanApplicationList';
import DecisionTimeline from './DecisionTimeline';
import CreateLoanForm from './CreateLoanForm';
import LoanList from './LoanList';
import AmortizationTable from './AmortizationTable';
import PaymentForm from './PaymentForm';
import DrawRequestForm from './DrawRequestForm';
import DrawRequestsTable from './DrawRequestsTable';
import LienWaiverForm from './LienWaiverForm';
import LienWaiverList from './LienWaiverList';
import InspectionForm from './InspectionForm';
import InspectionList from './InspectionList';
import EscrowDashboard from './EscrowDashboard';
import CollectionForm from './CollectionForm';
import CollectionsTable from './CollectionsTable';
import ProjectForm from './ProjectForm';
import ProjectsTable from './ProjectsTable';
import ProjectDetail from './ProjectDetail';
import AssetForm from './AssetForm';
import AssetsTable from './AssetsTable';

const navItems = [
  { label: 'Dashboard', icon: '🏠' },
  {
    label: 'Loans',
    icon: '💰',
    sub: ['Create Loan', 'Loan List']
  },
  {
    label: 'Applications',
    icon: '📝',
    sub: ['New Application', 'Application List']
  },
  {
    label: 'Servicing',
    icon: '🛠️',
    sub: ['Escrows', 'Collections']
  },
  {
    label: 'Projects',
    icon: '🏗️',
    sub: ['Projects', 'Draw Requests']
  },
  { label: 'Hospitality', icon: '🏨', sub: ['Assets'] },
  { label: 'Settings', icon: '⚙️' },
  { label: 'Decisions', icon: '📜' },
  { label: 'Assistant', icon: '🤖' }
];

export default function DashboardLayout() {
  const { session, supabase } = useContext(AuthContext);
  const [signUp, setSignUp] = useState(false);
  const [active, setActive] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
 
  if (!session) {
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    );
  }

   const renderContent = () => {
    switch (active) {
      case 'Dashboard':
        return <DashboardHome setActive={setActive} />;
      case 'New Application':
        return (
          <LoanApplicationForm onSubmitted={() => setRefreshKey(k => k + 1)} />
        );
      case 'Application List':
        return <LoanApplicationList key={refreshKey} />;
      case 'Create Loan':
        return <CreateLoanForm onCreated={() => setRefreshKey(k => k + 1)} />;
      case 'Loan List':
        return selectedId ? (
          <>
            <h3 className="text-xl mb-4">Loan Details #{selectedId}</h3>
            <AmortizationTable loanId={selectedId} />
            <PaymentForm
              loanId={selectedId}
              onSubmit={() => setRefreshKey(k => k + 1)}
            />
          </>
        ) : (
          <LoanList key={refreshKey} onSelect={setSelectedId} />
        );
      case 'New Request':
        return <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />;
      case 'Request List':
        return (
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
               );
      case 'Escrows':
        return <EscrowDashboard />;
      case 'Collections':
        return (
          <>
            <CollectionForm onCreated={() => setRefreshKey(k => k + 1)} />
            <CollectionsTable refresh={refreshKey} />
            </>
        );
      case 'Projects':
        return selectedProjectId ? (
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
            <ProjectForm onCreated={() => setProjectRefreshKey(k => k + 1)} />
            <ProjectsTable
              key={projectRefreshKey}
              onSelect={setSelectedProjectId}
            />
          </>
        );
      case 'Assets':
        return (
          <>
            <AssetForm onCreated={() => setRefreshKey(k => k + 1)} />
            <AssetsTable refresh={refreshKey} />
          </>
        );
        case 'Decisions':
        return <DecisionTimeline />;
      case 'Assistant':
        return (
          <div className="h-full flex flex-col border rounded-lg bg-white">
            <VirtualAssistant />
          </div>
        );
      default:
        return <p className="text-gray-500">Select an option</p>;
    }
  };

  return (
    <div className="flex h-screen">
      <aside
        className={`${sidebarOpen ? 'w-48' : 'w-16'} bg-gray-800 text-white flex flex-col transition-all`}
      >
        <button
          onClick={() => setSidebarOpen(o => !o)}
          className="p-4 text-2xl font-bold border-b border-gray-700 text-left"
        >
          {sidebarOpen ? 'Kontra' : 'K'}
        </button>
        <nav className="flex-1 overflow-auto py-4 space-y-1">
          {navItems.map(item => (
            <div key={item.label} className="text-sm">
              {item.sub ? (
                <>
                  <button
                    onClick={() => setActive(item.sub[0])}
                    className={`flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${
                      active === item.sub[0] ? 'bg-gray-700' : ''
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    {sidebarOpen && <span className="ml-2">{item.label}</span>}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setActive(item.label)}
                  className={`flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${
                    active === item.label ? 'bg-gray-700' : ''
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-2">{item.label}</span>}
                </button>
              )}
            </div>
          ))}
          <button
            onClick={() => supabase.auth.signOut()}
            className="flex items-center px-3 py-2 hover:bg-gray-700 rounded"
          >
            <span className="text-lg">🔓</span>
            {sidebarOpen && <span className="ml-2">Log Out</span>}
          </button>
        </nav>
      </aside>

      <div className="flex flex-1">
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between bg-white shadow p-4">
            <input
              className="border rounded p-2 w-1/3"
              placeholder="Search…"
              type="text"
            />
            <div className="flex items-center space-x-4">
              <span className="text-xl">🔔</span>
              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                {session.user?.email[0].toUpperCase()}
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto p-4 space-y-4">{renderContent()}</main>
        </div>
        <aside className="w-80 border-l bg-white flex flex-col">
          <VirtualAssistant />
        </aside>
      </div>
    </div>
  );
}
