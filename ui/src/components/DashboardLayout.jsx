import React, { useState, useContext, useEffect, lazy, Suspense } from 'react';
import { AuthContext } from '../lib/authContext';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import VirtualAssistant from './VirtualAssistant';
import SuggestFeatureWidget from './SuggestFeatureWidget';
import Sidebar from './Sidebar';
import HelpTooltip from './HelpTooltip';
import { isFeatureEnabled } from '../lib/featureFlags';
import useFeatureUsage from '../lib/useFeatureUsage';
import { departmentNav, toPath } from '../lib/navConfig';

const DashboardHome = lazy(() => import('./DashboardHome'));
const LoansDashboard = lazy(() => import('./LoansDashboard'));
const LoanApplicationForm = lazy(() => import('./LoanApplicationForm'));
const LoanApplicationList = lazy(() => import('./LoanApplicationList'));
const UnderwritingBoard = lazy(() => import('./UnderwritingBoard'));
const DecisionTimeline = lazy(() => import('./DecisionTimeline'));
const PaymentPortal = lazy(() => import('./PaymentPortal'));
const SelfServicePayment = lazy(() => import('./SelfServicePayment'));
const PayoffCalculator = lazy(() => import('./PayoffCalculator'));
const ReportBuilder = lazy(() => import('./ReportBuilder'));
const InvestorReportForm = lazy(() => import('./InvestorReportForm'));
const InvestorReportsList = lazy(() => import('./InvestorReportsList'));
const MarketAnalysis = lazy(() => import('./MarketAnalysis'));
const RealTimeAnalyticsDashboard = lazy(() => import('./RealTimeAnalyticsDashboard'));
const OrganizationSettings = lazy(() => import('./OrganizationSettings'));
const AssetManagement = lazy(() => import('../routes/AssetManagement'));
const Trades = lazy(() => import('../routes/Trades'));
const GuestCRM = lazy(() => import('./GuestCRM'));
const GuestChat = lazy(() => import('./GuestChat'));
const EscrowDashboard = lazy(() => import('./EscrowDashboard'));
const AssetRiskTable = lazy(() => import('../modules/assets/AssetRiskTable'));
const RevivedAssetsTable = lazy(() => import('./RevivedAssetsTable'));
const CollectionsTable = lazy(() => import('./CollectionsTable'));
const GuestReservations = lazy(() => import('./GuestReservations'));
const BookingCalendar = lazy(() => import('./BookingCalendar'));
const RestaurantMenu = lazy(() => import('./RestaurantMenu'));
const StaffRestaurantDashboard = lazy(() => import('./StaffRestaurantDashboard'));
const HospitalityDashboard = lazy(() => import('./HospitalityDashboard'));

export default function DashboardLayout() {
  const { session, supabase } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [department, setDepartment] = useState(
   () => (session?.user?.user_metadata?.role === 'hospitality' ? 'hospitality' : 'finance')
  );
  const navItems = departmentNav[department] || [];

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { usage, recordUsage } = useFeatureUsage();

  useEffect(() => {
    const firstItem = navItems[0];
    const navSet = new Set(
      navItems.flatMap(item =>
        item.sub ? item.sub.map(toPath) : [toPath(item.label)]
      )
    );
    if (
      firstItem &&
      (location.pathname === '/' || !navSet.has(location.pathname))
    ) {
      const targetLabel = firstItem.sub ? firstItem.sub[0] : firstItem.label;
      navigate(toPath(targetLabel));
    }
  }, [department, location.pathname]);

  const pages = {
     Dashboard: () =>
      department === 'hospitality' ? (
        <HospitalityDashboard navigateTo={label => navigate(toPath(label))} />
      ) : (
        <DashboardHome />
      ),
    Loans: LoansDashboard,
    'New Application': () => (
      <LoanApplicationForm onSubmitted={() => setRefreshKey(k => k + 1)} />
    ),
    'Application List': () => <LoanApplicationList key={refreshKey} />,
    'Underwriting Board': UnderwritingBoard,
    Decisions: DecisionTimeline,
    'Payment Portal': PaymentPortal,
    'Self Service Payment': SelfServicePayment,
    'Prepayment Calculator': PayoffCalculator,
    Reports: ReportBuilder,
    'Investor Reports': () => (
      <>
        <InvestorReportForm onCreated={() => setRefreshKey(k => k + 1)} />
        <InvestorReportsList refresh={refreshKey} />
      </>
    ),
   'Escrows': EscrowDashboard,
    'Troubled Assets': AssetRiskTable,
    'Revived Sales': RevivedAssetsTable,
    Collections: () => <CollectionsTable refresh={refreshKey} />,
    'Market Analysis': MarketAnalysis,
    'Live Analytics': RealTimeAnalyticsDashboard,
      ...(isFeatureEnabled('trading') ? { Trades } : {}),
    'Asset Management': AssetManagement,
    'Guest CRM': () => (isFeatureEnabled('hospitality') ? <GuestCRM /> : null),
    'Guest Chat': () => (isFeatureEnabled('hospitality') ? <GuestChat /> : null),
        'Guest Reservations': () =>
      isFeatureEnabled('hospitality') ? <GuestReservations /> : null,
    'Booking Calendar': () =>
      isFeatureEnabled('hospitality') ? <BookingCalendar /> : null,
    'Restaurant Menu': () =>
      isFeatureEnabled('hospitality') ? <RestaurantMenu /> : null,
    'Restaurant Dashboard': () =>
      isFeatureEnabled('hospitality') ? <StaffRestaurantDashboard /> : null,
    Settings: OrganizationSettings
  };

  const routes = Object.entries(pages).map(([label, Page]) => (
    <Route key={label} path={toPath(label)} element={<Page />} />
  ));

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900">
      <Sidebar
        navItems={navItems}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        department={department}
        setDepartment={setDepartment}
        supabase={supabase}
        usage={usage}
        recordUsage={recordUsage}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between bg-gray-900 border-b border-gray-700 p-4 text-white">
          <div className="flex items-center">
            <input
              className="px-3 py-1 rounded bg-gray-700 text-white placeholder-gray-400 focus:outline-none border border-gray-600 w-1/3"
              placeholder="Search…"
              type="text"
            />
            <HelpTooltip text="Search across loans, customers and projects" />
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xl" title="Notifications">🔔</span>
            <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              {session.user?.email[0].toUpperCase()}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 space-y-4 bg-white text-gray-900">
           <Suspense fallback={<p>Loading...</p>}>
            <Routes>{routes}</Routes>
          </Suspense>
        </main>
      </div>

      {/* Right-side Widgets */}
      <aside className="md:w-80 w-full border-l border-gray-700 bg-gray-800 p-2 space-y-2 text-white">
        <VirtualAssistant />
        <SuggestFeatureWidget />
      </aside>
    </div>
  );
}
