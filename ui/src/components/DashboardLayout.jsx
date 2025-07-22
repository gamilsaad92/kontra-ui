import React, { useState, useContext, useEffect, lazy, Suspense } from 'react';
import { AuthContext } from '../main';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
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
import UnderwritingBoard from './UnderwritingBoard';
import InvestorReportForm from './InvestorReportForm';
import InvestorReportsList from './InvestorReportsList';
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
import BookingCalendar from './BookingCalendar';
import BulkActionTable from './BulkActionTable';
import ReportBuilder from './ReportBuilder';
import LiveChat from './LiveChat';
import CustomerPortal from './CustomerPortal';
import OrganizationSettings from './OrganizationSettings';
import RestaurantMenu from './RestaurantMenu';
import StaffRestaurantDashboard from './StaffRestaurantDashboard';
import HelpTooltip from './HelpTooltip';
import { isFeatureEnabled } from '../lib/featureFlags';
import useFeatureUsage from '../lib/useFeatureUsage';

const departmentNav = {
  finance: [
    { label: 'Application', icon: '📝', sub: ['New Application', 'Application List'] },
    { label: 'Underwriting', icon: '✅', sub: ['Underwriting Board', 'Decisions'] },
    { label: 'Escrow Setup', icon: '💼', sub: ['Escrows'] },
    { label: 'Servicing', icon: '🛠️', sub: ['Payment Portal', 'Self Service Payment'] },
    { label: 'Risk Monitoring', icon: '📈', sub: ['Troubled Assets', 'Revived Sales'] },
    { label: 'Investor Reporting', icon: '📊', sub: ['Reports', 'Investor Reports'] },
    { label: 'Collections', icon: '💵', sub: ['Collections'] },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ],
  hospitality: [
    { label: 'Hospitality Dashboard', icon: '🏨' },
    { label: 'Guest CRM', icon: '👥' },
    { label: 'Guest Chat', icon: '💬' },
    { label: 'Guest Reservations', icon: '🛏️', flag: 'hospitality' },
    { label: 'Booking Calendar', icon: '📅', flag: 'hospitality' },
    { label: 'Restaurant Menu', icon: '🍽️' },
    { label: 'Restaurant Dashboard', icon: '📊' },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ]
};

const slug = str => str.toLowerCase().replace(/\s+/g, '-');
const toPath = label => (label === 'Dashboard' ? '/' : `/${slug(label)}`);

export default function DashboardLayout() {
  const { session, supabase } = useContext(AuthContext);
    const navigate = useNavigate();
  const location = useLocation();
   const [department, setDepartment] = useState(() =>
    session?.user?.user_metadata?.role === 'hospitality' ? 'hospitality' : 'finance'
  );
  const defaultItem = departmentNav[department][0];
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [projectRefreshKey, setProjectRefreshKey] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);

 const { usage, recordUsage } = useFeatureUsage();
  
  const navItems = departmentNav[department] || [];
    const frequentItems = navItems
    .filter(i => usage[i.label])
    .sort((a, b) => usage[b.label] - usage[a.label])
    .slice(0, 3);
  const navigateTo = label => navigate(toPath(label));
  const renderItem = item => {
    const label = item.sub ? item.sub[0] : item.label;
    const path = toPath(label);
    const active = location.pathname === path;
    const common = {
      className: `flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${
        active ? 'bg-gray-700' : ''
      }`,
      title: item.label,
      onClick: () => recordUsage(item.label)
    };
    return (
      <div key={item.label} className="text-sm">
        {item.href ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" {...common}>
            <span className="text-lg">{item.icon}</span>
            {sidebarOpen && <span className="ml-2">{item.label}</span>}
          </a>
        ) : (
          <Link to={path} {...common}>
            <span className="text-lg">{item.icon}</span>
            {sidebarOpen && <span className="ml-2">{item.label}</span>}
          </Link>
        )}
      </div>
    );
  };
  
  useEffect(() => {
    const first = navItems[0];
    if (first) {
       navigate(toPath(first.sub ? first.sub[0] : first.label));
    }
  }, [department]);

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

   const pages = {
    Dashboard: () => <DashboardHome navigateTo={navigateTo} />,
    'New Application': () => (
      <LoanApplicationForm onSubmitted={() => setRefreshKey(k => k + 1)} />
    ),
    'Application List': () => <LoanApplicationList key={refreshKey} />,
    'Underwriting Board': () => <UnderwritingBoard />,
    'Create Loan': () => <CreateLoanForm onCreated={() => setRefreshKey(k => k + 1)} />,
    'Loan List': () =>
      selectedId ? (
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
      ),
    'New Request': () => <DrawRequestForm onSubmitted={() => setRefreshKey(k => k + 1)} />,
    'Request List': () => (
      <>
        <DrawRequestsTable key={refreshKey} onSelect={setSelectedId} />
        {selectedId && (
        <>
                  <LienWaiverForm drawId={selectedId} />
            <LienWaiverList filter={{ draw_id: selectedId }} />
            <InspectionForm drawId={selectedId} />
            <InspectionList drawId={selectedId} />
          </>
       )}
      </>
    ),
    'Draw Board': () => <DrawKanbanBoard />,
    Escrows: () => <EscrowDashboard />,
    Collections: () => (
      <>
        <CollectionForm onCreated={() => setRefreshKey(k => k + 1)} />
        <CollectionsTable refresh={refreshKey} />
      </>
    ),
    Projects: () =>
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
          <ProjectForm onCreated={() => setProjectRefreshKey(k => k + 1)} />
          <ProjectsTable
            key={projectRefreshKey}
            onSelect={setSelectedProjectId}
          />
        </>
      ),
    'Payment Portal': () => <PaymentPortal />,
    'Customer Portal': () => <CustomerPortal />,
    'Self Service Payment': () => <SelfServicePayment />,
    'Restaurant Menu': () => <RestaurantMenu />,
    'Restaurant Dashboard': () => <StaffRestaurantDashboard />,
    'Guest Reservations': () =>
      isFeatureEnabled('hospitality') ? <GuestReservations /> : null,
    'Booking Calendar': () =>
      isFeatureEnabled('hospitality') ? <BookingCalendar /> : null,
    'Bulk Actions': () => <BulkActionTable rows={[]} columns={[]} />,
    Reports: () => <ReportBuilder />,
    'Investor Reports': () => (
      <>
        <InvestorReportForm onCreated={() => setRefreshKey(k => k + 1)} />
        <InvestorReportsList refresh={refreshKey} />
      </>
    ),
    'Hospitality Dashboard': () => (
      <Suspense fallback={<p>Loading...</p>}>
        <HospitalityDashboard navigateTo={navigateTo} />
      </Suspense>
    ),
    'Guest CRM': () =>
      isFeatureEnabled('hospitality') ? (
        <Suspense fallback={<p>Loading...</p>}>
          <GuestCRM />
        </Suspense>
      ) : null,
    'Guest Chat': () =>
      isFeatureEnabled('hospitality') ? (
        <Suspense fallback={<p>Loading...</p>}>
          <GuestChat />
        </Suspense>
      ) : null,
    Assets: () => (
      <>
        <AssetForm onCreated={() => setRefreshKey(k => k + 1)} />
        <AssetsTable refresh={refreshKey} />
      </>
    ),
    'Troubled Assets': () =>
      isFeatureEnabled('assets') ? (
        <Suspense fallback={<p>Loading...</p>}>
          <AssetRiskTable />
        </Suspense>
      ) : null,
    'Revived Sales': () =>
      isFeatureEnabled('assets') ? (
        <Suspense fallback={<p>Loading...</p>}>
          <RevivedAssetsTable />
        </Suspense>
      ) : null,
    Settings: () => <OrganizationSettings />,
    Decisions: () => <DecisionTimeline />,
    Assistant: () => (
      <div className="h-full flex flex-col border rounded-lg bg-white">
        <VirtualAssistant />
      </div>
    ),
    'Live Chat': () =>
      isFeatureEnabled('chat') ? (
        <div className="h-full flex flex-col border rounded-lg bg-white">
          <LiveChat />
        </div>
      ) : null
  };

 const routes = Object.entries(pages).map(([label, Component]) => (
    <Route key={label} path={toPath(label)} element={<Component />} />
  ));

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
       <select
          value={department}
          onChange={e => setDepartment(e.target.value)}
          className="m-2 p-1 text-black rounded"
        >
          <option value="finance">Finance</option>
          <option value="hospitality">Hospitality</option>
        </select>
        <nav className="flex-1 overflow-auto py-4 space-y-1">
                {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              {frequentItems.map(renderItem)}
              <hr className="border-gray-700" />
            </div>
          )}
          {navItems
            .filter(item => !item.flag || isFeatureEnabled(item.flag))
          .filter(item => !frequentItems.includes(item))
            .map(renderItem)}
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
           <div className="flex items-center">
              <input
                className="border rounded p-2 w-1/3"
                placeholder="Search…"
                aria-label="Search"
                title="Search across your data"
                type="text"
              />
              <HelpTooltip text="Search across loans, customers and projects" />
            </div>
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
          <main id="main" className="flex-1 overflow-auto p-4 space-y-4">
            <Routes>
              {routes}
            </Routes>
          </main>
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
