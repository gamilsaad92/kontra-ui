import React, { useState, useContext, useEffect, lazy, Suspense } from 'react';
import { AuthContext } from '../lib/authContext';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import VirtualAssistant from './VirtualAssistant';
import SuggestFeatureWidget from './SuggestFeatureWidget';
import LoansDashboard from './LoansDashboard';
import DashboardHome from './DashboardHome';
import LoanApplicationForm from './LoanApplicationForm';
import LoanApplicationList from './LoanApplicationList';
import DecisionTimeline from './DecisionTimeline';
import UnderwritingBoard from './UnderwritingBoard';
import CreateLoanForm from './CreateLoanForm';
import LoanList from './LoanList';
import AmortizationTable from './AmortizationTable';
import PaymentPortal from './PaymentPortal';
import SelfServicePayment from './SelfServicePayment';
import PayoffCalculator from './PayoffCalculator';
import InvestorReportForm from './InvestorReportForm';
import InvestorReportsList from './InvestorReportsList';
import AssetManagement from '../routes/AssetManagement';
import MarketAnalysis from './MarketAnalysis';
import RealTimeAnalyticsDashboard from './RealTimeAnalyticsDashboard';
import OrganizationSettings from './OrganizationSettings';
import ReportBuilder from './ReportBuilder';
import HelpTooltip from './HelpTooltip';
import { isFeatureEnabled } from '../lib/featureFlags';
import useFeatureUsage from '../lib/useFeatureUsage';
import Trades from '../routes/Trades';
import {
  HomeIcon,
  BanknotesIcon,
  DocumentPlusIcon,
  CheckBadgeIcon,
  BriefcaseIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  ChartBarSquareIcon,
  ArrowsRightLeftIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
  BellIcon,
  MagnifyingGlassIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';

const GuestCRM = lazy(() => import('./GuestCRM'));
const GuestChat = lazy(() => import('./GuestChat'));

const departmentNav = {
  finance: [
    { label: 'Dashboard', icon: HomeIcon },
    { label: 'Loans', icon: BanknotesIcon },
    { label: 'Application', icon: DocumentPlusIcon, sub: ['New Application', 'Application List'] },
    { label: 'Underwriting', icon: CheckBadgeIcon, sub: ['Underwriting Board', 'Decisions'] },
    { label: 'Escrow Setup', icon: BriefcaseIcon, sub: ['Escrows'] },
    {
      label: 'Servicing',
      icon: WrenchScrewdriverIcon,
      sub: ['Payment Portal', 'Self Service Payment', 'Prepayment Calculator'],
    },
    { label: 'Risk Monitoring', icon: ChartBarIcon, sub: ['Troubled Assets', 'Revived Sales'] },
    { label: 'Investor Reporting', icon: ChartPieIcon, sub: ['Reports', 'Investor Reports'] },
    { label: 'Market Analysis', icon: PresentationChartLineIcon },
    { label: 'Live Analytics', icon: ChartBarSquareIcon },
    { label: 'Trades', icon: ArrowsRightLeftIcon, flag: 'trading' },
    { label: 'Asset Management', icon: BuildingOfficeIcon },
    { label: 'Collections', icon: CurrencyDollarIcon, sub: ['Collections'] },
    { label: 'Settings', icon: Cog6ToothIcon },
    { label: 'Docs', icon: DocumentTextIcon, href: 'https://github.com/kontra-ui/docs' },
  ],
  hospitality: [
     { label: 'Dashboard', icon: HomeIcon },
    { label: 'Guest CRM', icon: UserGroupIcon },
    { label: 'Guest Chat', icon: ChatBubbleLeftRightIcon },
    { label: 'Guest Reservations', icon: CalendarDaysIcon, flag: 'hospitality' },
    { label: 'Booking Calendar', icon: CalendarDaysIcon, flag: 'hospitality' },
    { label: 'Restaurant Menu', icon: ClipboardDocumentListIcon },
    { label: 'Restaurant Dashboard', icon: PresentationChartLineIcon },
    { label: 'Settings', icon: Cog6ToothIcon },
    { label: 'Docs', icon: DocumentTextIcon, href: 'https://github.com/kontra-ui/docs' },
  ],
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

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { usage, recordUsage } = useFeatureUsage();
  const frequentItems = navItems
    .filter(i => usage[i.label])
    .sort((a, b) => usage[b.label] - usage[a.label])
    .slice(0, 3);

  const navigateTo = label => navigate(toPath(label));
  const renderItem = item => {
    const label = item.sub ? item.sub[0] : item.label;
    const path = toPath(label);
        const Icon = item.icon;
    const base =
      'group flex items-center w-full gap-3 rounded-md px-3 py-2 text-sm font-medium';
    const state = active
      ? 'bg-slate-800 text-white'
      : 'text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900';
    const content = (
      <>
        {Icon && <Icon className="h-5 w-5 shrink-0" />}
        {sidebarOpen && <span className="truncate">{item.label}</span>}
      </>
    );
    const active = location.pathname === path;
      <div key={item.label}>
        {item.href ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${base} ${state}`}
            title={item.label}
            onClick={() => recordUsage(item.label)}
          >
               {content}
          </a>
        ) : (
          <Link
          to={path}   
             className={`${base} ${state}`}
            title={item.label}
            onClick={() => recordUsage(item.label)}
          >
                   {content}
          </Link>
        )}
      </div>
    );
  };

  useEffect(() => {
    const firstItem = navItems[0];
    if (firstItem) {
      const targetLabel = firstItem.sub ? firstItem.sub[0] : firstItem.label;
      navigate(toPath(targetLabel));
    }
  }, [department]);

  const pages = {
    Dashboard: () => <DashboardHome navigateTo={navigateTo} />,
    Loans: () => <LoansDashboard />,
    'New Application': () => <LoanApplicationForm onSubmitted={() => setRefreshKey(k => k + 1)} />,
    'Application List': () => <LoanApplicationList key={refreshKey} />,
    'Underwriting Board': () => <UnderwritingBoard />,
    Decisions: () => <DecisionTimeline />,
    'Payment Portal': () => <PaymentPortal />,
    'Self Service Payment': () => <SelfServicePayment />,
    'Prepayment Calculator': () => <PayoffCalculator />,
    Reports: () => <ReportBuilder />,
    'Investor Reports': () => (
      <>
        <InvestorReportForm onCreated={() => setRefreshKey(k => k + 1)} />
        <InvestorReportsList refresh={refreshKey} />
      </>
    ),
    'Market Analysis': () => <MarketAnalysis />,
    'Live Analytics': () => <RealTimeAnalyticsDashboard />,
    'Trades': () => <Trades />,
    'Asset Management': () => <AssetManagement />,
    'Guest CRM': () => isFeatureEnabled('hospitality') ? (
      <Suspense fallback={<p>Loading...</p>}><GuestCRM /></Suspense>
    ) : null,
    'Guest Chat': () => isFeatureEnabled('hospitality') ? (
      <Suspense fallback={<p>Loading...</p>}><GuestChat /></Suspense>
    ) : null,
    Settings: () => <OrganizationSettings />
  };

  const routes = Object.entries(pages).map(([label, Component]) => (
    <Route key={label} path={toPath(label)} element={<Component />} />
  ));

  return (
 <div className="flex min-h-screen flex-col lg:flex-row bg-slate-100 text-slate-900">
   
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? 'md:w-64' : 'md:w-20'} w-full bg-slate-950 text-slate-100 flex flex-col transition-all`}
        aria-label="Main navigation"
      >
        <button
          onClick={() => setSidebarOpen(o => !o)}
           className="px-4 py-4 flex items-center gap-2 text-sm font-semibold tracking-tight border-b border-slate-800"
        >
        <span className="truncate">{sidebarOpen ? 'Kontra' : 'K'}</span>
        </button>
        <select
          aria-label="Select department"
          value={department}
          onChange={e => setDepartment(e.target.value)}
           className="m-2 p-2 bg-slate-800 text-slate-100 rounded focus:outline-none focus:ring-2 focus:ring-sky-500"
        >
          <option value="finance">Finance</option>
          <option value="hospitality">Hospitality</option>
        </select>
          <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              {frequentItems.map(renderItem)}
            <hr className="border-slate-800" />
            </div>
          )}
          {navItems
            .filter(item => !item.flag || isFeatureEnabled(item.flag))
            .filter(item => !frequentItems.includes(item))
            .map(renderItem)}
          <button
            onClick={() => supabase.auth.signOut()}
               className="group flex items-center w-full gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900"
          >
           <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="truncate">Log Out</span>}
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
            <header className="flex items-center justify-between bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-5 w-5 text-slate-400" />
              <input
                aria-label="Search"
                className="pl-9 pr-3 py-2 rounded-md bg-slate-100 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 border border-slate-300"
                placeholder="Search…"
                type="text"
              />
            </div>
            <HelpTooltip text="Search across loans, customers and projects" />
          </div>
            <div className="flex items-center gap-4">
            <BellIcon className="h-5 w-5 text-slate-500" title="Notifications" />
            <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-sm font-medium">
              {session.user?.email[0].toUpperCase()}
            </div>
          </div>
        </header>
      <main className="flex-1 overflow-auto p-6 space-y-6">
          <Routes>{routes}</Routes>
        </main>
      </div>

      {/* Right-side Widgets */}
         <aside className="hidden lg:flex lg:w-80 flex-col border-l border-slate-200 bg-slate-50 p-4 space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <VirtualAssistant />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <SuggestFeatureWidget />
        </div>
      </aside>
    </div>
  );
}
