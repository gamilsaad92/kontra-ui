import React, { useState, useContext, useEffect, lazy, Suspense } from 'react';
import { AuthContext } from '../lib/authContext';
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
// Removed separate HospitalityDashboard – using unified DashboardHome for both roles
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
import RealTimeAnalyticsDashboard from './RealTimeAnalyticsDashboard';
import MarketAnalysis from './MarketAnalysis';
import OrganizationSettings from './OrganizationSettings';
import RestaurantMenu from './RestaurantMenu';
import StaffRestaurantDashboard from './StaffRestaurantDashboard';
import HelpTooltip from './HelpTooltip';
import { isFeatureEnabled } from '../lib/featureFlags';
import useFeatureUsage from '../lib/useFeatureUsage';

const departmentNav = {
  finance: [
    { label: 'Dashboard', icon: '🏠' },  // New Dashboard entry for Finance
    { label: 'Application', icon: '📝', sub: ['New Application', 'Application List'] },
    { label: 'Underwriting', icon: '✅', sub: ['Underwriting Board', 'Decisions'] },
    { label: 'Escrow Setup', icon: '💼', sub: ['Escrows'] },
    { label: 'Servicing', icon: '🛠️', sub: ['Payment Portal', 'Self Service Payment'] },
    { label: 'Risk Monitoring', icon: '📈', sub: ['Troubled Assets', 'Revived Sales'] },
    { label: 'Investor Reporting', icon: '📊', sub: ['Reports', 'Investor Reports'] },
    { label: 'Market Analysis', icon: '🏙️' },
    { label: 'Live Analytics', icon: '📈' },
    { label: 'Collections', icon: '💵', sub: ['Collections'] },
    { label: 'Settings', icon: '⚙️' },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ],
  hospitality: [
    { label: 'Dashboard', icon: '🏨' },  // New Dashboard entry for Hospitality
    { label: 'Guest CRM', icon: '👥' },
    { label: 'Guest Chat', icon: '💬' },
    { label: 'Guest Reservations', icon: '🛏️', flag: 'hospitality' },
    { label: 'Booking Calendar', icon: '📅', flag: 'hospitality' },
    { label: 'Restaurant Menu', icon: '🍽️' },
    { label: 'Restaurant Dashboard', icon: '📊' },
    { label: 'Settings', icon: '⚙️' },
    { label: 'Docs', icon: '📄', href: 'https://github.com/kontra-ui/docs' }
  ]
};

const slug = str => str.toLowerCase().replace(/\s+/g, '-');
const toPath = label => (label === 'Dashboard' ? '/' : `/${slug(label)}`);

export default function DashboardLayout() {
  const { session, supabase } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [department, setDepartment] = useState(
    () => session?.user?.user_metadata?.role === 'hospitality' ? 'hospitality' : 'finance'
  );
  const navItems = departmentNav[department] || [];

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  
  const { usage, recordUsage } = useFeatureUsage();
  const frequentItems = navItems
    .filter(i => usage[i.label])
    .sort((a, b) => usage[b.label] - usage[a.label])
    .slice(0, 3);

  const navigateTo = label => navigate(toPath(label));
  const renderItem = item => {
    const label = item.sub ? item.sub[0] : item.label;
    const path = toPath(label);
    const active = location.pathname === path;
    const commonProps = {
      className: `flex items-center w-full px-3 py-2 hover:bg-gray-700 rounded ${active ? 'bg-gray-700' : ''}`,
      title: item.label,
      onClick: () => recordUsage(item.label)
    };
    return (
      <div key={item.label} className="text-sm">
        {item.href ? (
          <a href={item.href} target="_blank" rel="noopener noreferrer" {...commonProps}>
            <span className="text-lg">{item.icon}</span>
            {sidebarOpen && <span className="ml-2">{item.label}</span>}
          </a>
        ) : (
          <Link to={path} {...commonProps}>
            <span className="text-lg">{item.icon}</span>
            {sidebarOpen && <span className="ml-2">{item.label}</span>}
          </Link>
        )}
      </div>
    );
  };

  // On department change, navigate to the first nav item (Dashboard)
  useEffect(() => {
    const firstItem = navItems[0];
    if (firstItem) {
      const targetLabel = firstItem.sub ? firstItem.sub[0] : firstItem.label;
      navigate(toPath(targetLabel));  // e.g. "/" for Dashboard
    }
  }, [department]);

  // ... (header, sidebar toggle, etc. unchanged for brevity) ...

  const pages = {
    Dashboard: () => <DashboardHome navigateTo={navigateTo} />,          // unified Dashboard for both roles
    'New Application': () => <LoanApplicationForm onSubmitted={() => setRefreshKey(k => k + 1)} />,
    'Application List': () => <LoanApplicationList key={refreshKey} />,
    'Underwriting Board': () => <UnderwritingBoard />,
    'Decisions': () => <DecisionTimeline />,
    // ... (other routes unchanged) ...
    Reports: () => <ReportBuilder />,
    'Investor Reports': () => (
      <>
        <InvestorReportForm onCreated={() => setRefreshKey(k => k + 1)} />
        <InvestorReportsList refresh={refreshKey} />
      </>
    ),
    'Market Analysis': () => <MarketAnalysis />,
    'Live Analytics': () => <RealTimeAnalyticsDashboard />,
    // Removed 'Hospitality Dashboard' route – both roles use DashboardHome now
    'Guest CRM': () => isFeatureEnabled('hospitality') ? (
      <Suspense fallback={<p>Loading...</p>}><GuestCRM /></Suspense>
    ) : null,
    'Guest Chat': () => isFeatureEnabled('hospitality') ? (
      <Suspense fallback={<p>Loading...</p>}><GuestChat /></Suspense>
    ) : null,
    // ... (Assets, Settings, etc. unchanged) ...
  };

  const routes = Object.entries(pages).map(([label, Component]) => (
    <Route key={label} path={toPath(label)} element={<Component />} />
  ));

  return (
   <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'md:w-48' : 'md:w-16'} w-full bg-gray-800 text-white flex flex-col transition-all`} aria-label="Main navigation">
        <button onClick={() => setSidebarOpen(o => !o)} className="p-4 text-2xl font-bold border-b border-gray-700 text-left">
          {sidebarOpen ? 'Kontra' : 'K'}
        </button>
             <select value={department} onChange={e => setDepartment(e.target.value)} className="m-2 p-1 bg-gray-700 text-white rounded">
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
          {navItems.filter(item => !item.flag || isFeatureEnabled(item.flag))
                   .filter(item => !frequentItems.includes(item))
                   .map(renderItem)}
          <button onClick={() => supabase.auth.signOut()} className="flex items-center px-3 py-2 hover:bg-gray-700 rounded">
            <span className="text-lg">🔓</span>
            {sidebarOpen && <span className="ml-2">Log Out</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content & Dashboard Routes */}
      <div className="flex flex-1 flex-col">
             <header className="flex items-center justify-between bg-gray-900 border-b border-gray-700 p-4">
          <div className="flex items-center">
                     <input className="px-3 py-1 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none border border-gray-600 w-1/3" placeholder="Search…" type="text" />
            <HelpTooltip text="Search across loans, customers and projects" />
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xl" title="Notifications">🔔</span>
                   <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center" title="Account">
              {session.user?.email[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 space-y-4">
          <Routes>{routes}</Routes>
        </main>
      </div>

      {/* Right-side widgets (assistant, etc.) */}
     <aside className="md:w-80 w-full border-l border-gray-700 bg-gray-800 p-2 space-y-2 text-white">
        <VirtualAssistant />
        <SuggestFeatureWidget />
      </aside>
    </div>
  );
}
