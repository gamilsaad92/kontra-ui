import React, { useState, useContext, useEffect, lazy, Suspense } from 'react';
import { AuthContext } from '../main';
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';
import VirtualAssistant from './VirtualAssistant';
import SuggestFeatureWidget from './SuggestFeatureWidget';
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
import PaymentPortal from './PaymentPortal';
import DrawKanbanBoard from './DrawKanbanBoard';
const HospitalityDashboard = lazy(() => import('./HospitalityDashboard'));
const GuestCRM = lazy(() => import('./GuestCRM'));
const GuestChat = lazy(() => import('./GuestChat'));
const RevivedAssetsTable = lazy(() => import('../modules/assets/RevivedAssetsTable'));
const AssetRiskTable = lazy(() => import('../modules/assets/AssetRiskTable'));
import GuidedSetup from './GuidedSetup';
import QuickStartTour from './QuickStartTour';
import SelfServicePayment from './SelfServicePayment';
import WelcomeWizard from './WelcomeWizard';
import GuestReservations from './GuestReservations';
import BulkActionTable from './BulkActionTable';
import LiveChat from './LiveChat';
import CustomerPortal from './CustomerPortal';

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
  { label: 'Payment Portal', icon: '💳' },
  { label: 'Customer Portal', icon: '👤' },
  { label: 'Self Service Payment', icon: '💵' },
  { label: 'Guest Reservations', icon: '📅' },
  { label: 'Bulk Actions', icon: '📂' },
  { label: 'Hospitality', icon: '🏨', sub: ['Hospitality Dashboard'] },
  { label: 'Troubled Assets', icon: '🚩' },
  { label: 'Revived Sales', icon: '🏘️' },
  { label: 'Settings', icon: '⚙️' },
  { label: 'Decisions', icon: '📜' },
  { label: 'Assistant', icon: '🤖' },
   { label: 'Live Chat', icon: '💬' },
  { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
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
  const [showSetup, setShowSetup] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

  const handleWelcomeDone = () => {
    localStorage.setItem('welcomeDone', 'true');
    setShowWelcome(false);
    const visited = localStorage.getItem('visited');
    setShowSetup(!visited);
  };
  
  useEffect(() => {
    if (session) {
      const visited = localStorage.getItem('visited');
           const welcome = localStorage.getItem('welcomeDone');
      if (!welcome) {
        setShowWelcome(true);
      } else {
        if (visited) {
          setShowLanding(false);
        }
        setShowSetup(!visited);
      }
    }
    }, [session]);
  
  if (!session) {
    return signUp ? (
      <SignUpForm onSwitch={() => setSignUp(false)} />
    ) : (
      <LoginForm onSwitch={() => setSignUp(true)} />
    );
  }

    if (showLanding) {
    const role = session.user?.user_metadata?.role;
    const title = role === 'hospitality' ? "Today's Arrivals" : 'My Pending Reviews';
    return (
      <div className="p-8 space-y-4">
        <h2 className="text-2xl font-bold">{title}</h2>
        <button
          onClick={() => {
            localStorage.setItem('visited', 'true');
            setShowLanding(false);
            setShowSetup(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Continue to Dashboard
        </button>
      </div>
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
      case 'Draw Board':
        return <DrawKanbanBoard />;
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
      case 'Payment Portal':
           return <PaymentPortal />;
      case 'Customer Portal':
        return <CustomerPortal />;
      case 'Self Service Payment':
        return <SelfServicePayment />;
      case 'Guest Reservations':
        return <GuestReservations />;
      case 'Bulk Actions':
        return <BulkActionTable rows={[]} columns={[]} />;
            case 'Hospitality Dashboard':
        return (
          <Suspense fallback={<p>Loading...</p>}>
            <HospitalityDashboard setActive={setActive} />
          </Suspense>
        );    
      case 'Guest CRM':
       return (
          <Suspense fallback={<p>Loading...</p>}>
            <GuestCRM />
          </Suspense>
        );
      case 'Guest Chat':
            return (
          <Suspense fallback={<p>Loading...</p>}>
            <GuestChat />
          </Suspense>
        );
      case 'Assets':
        return (
          <>
            <AssetForm onCreated={() => setRefreshKey(k => k + 1)} />
            <AssetsTable refresh={refreshKey} />
          </>
        );
      case 'Troubled Assets':
         return (
          <Suspense fallback={<p>Loading...</p>}>
            <AssetRiskTable />
          </Suspense>
        );
      case 'Revived Sales':
             return (
          <Suspense fallback={<p>Loading...</p>}>
            <RevivedAssetsTable />
          </Suspense>
        );
      case 'Decisions':
        return <DecisionTimeline />;
      case 'Assistant':
        return (
          <div className="h-full flex flex-col border rounded-lg bg-white">
            <VirtualAssistant />
          </div>
        );
      case 'Live Chat':
        return (
          <div className="h-full flex flex-col border rounded-lg bg-white">
            <LiveChat />
          </div>
        );
      default:
        return <p className="text-gray-500">Select an option</p>;
    }
  };

  return (
        <>
          <div className="flex h-screen">
      <aside
        className={`${sidebarOpen ? 'w-48' : 'w-16'} bg-gray-800 text-white flex flex-col transition-all`}
      >
        <button
          onClick={() => setSidebarOpen(o => !o)}
          aria-label="Toggle navigation"
          className="p-4 text-2xl font-bold border-b border-gray-700 text-left focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          {sidebarOpen ? 'Kontra' : 'K'}
        </button>
        <nav className="flex-1 overflow-auto py-4 space-y-1">
          {navItems.map(item => (
            <div key={item.label} className="text-sm">
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.label}
                  className="flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded"
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-2">{item.label}</span>}
                </a>
              ) : item.sub ? (
                <button
                  onClick={() => setActive(item.sub[0])}
                  title={item.label}
                  className={`flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${
                    active === item.sub[0] ? 'bg-gray-700' : ''
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  {sidebarOpen && <span className="ml-2">{item.label}</span>}
                </button>
              ) : (
                <button
                  onClick={() => setActive(item.label)}
                  title={item.label}
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
              aria-label="Search"
              title="Search across your data"
              type="text"
            />
            <div className="flex items-center space-x-4">
              <span className="text-xl" title="Notifications">🔔</span>
              <div
                className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center"
                title="Account"
              >
                {session.user?.email[0].toUpperCase()}
              </div>
            </div>
          </header>
          <main id="main" className="flex-1 overflow-auto p-4 space-y-4">{renderContent()}</main>
        </div>
        <aside className="w-80 border-l bg-white flex flex-col p-2 space-y-2">
          <VirtualAssistant />
          <SuggestFeatureWidget />    
        </aside>
      </div>
    </div>
        {showWelcome && <WelcomeWizard onDone={handleWelcomeDone} />}
    {showSetup && (
      <GuidedSetup
        onDone={() => {
          setShowSetup(false);
          setShowTour(true);
        }}
      />
    )}
    {showTour && <QuickStartTour onClose={() => setShowTour(false)} />}
    </>
  );
}
