import React, { useState, useContext, useEffect, lazy, Suspense } from "react";
import { AuthContext } from "../lib/authContext";
import { Routes, Route, Link, useNavigate, useLocation } from "react-router-dom";

import DashboardHome from "./DashboardHome";
import VirtualAssistant from "./VirtualAssistant";
import SuggestFeatureWidget from "./SuggestFeatureWidget";

import LoansDashboard from "./LoansDashboard";
import LoanApplicationForm from "./LoanApplicationForm";
import LoanApplicationList from "./LoanApplicationList";
import DecisionTimeline from "./DecisionTimeline";
import UnderwritingBoard from "./UnderwritingBoard";
import CreateLoanForm from "./CreateLoanForm";
import LoanList from "./LoanList";
import AmortizationTable from "./AmortizationTable";
import PaymentPortal from "./PaymentPortal";
import SelfServicePayment from "./SelfServicePayment";
import PayoffCalculator from "./PayoffCalculator";
import InvestorReportForm from "./InvestorReportForm";
import InvestorReportsList from "./InvestorReportsList";
import AssetManagement from "../routes/AssetManagement";
import MarketAnalysis from "./MarketAnalysis";
import RealTimeAnalyticsDashboard from "./RealTimeAnalyticsDashboard";
import OrganizationSettings from "./OrganizationSettings";
import ReportBuilder from "./ReportBuilder";
import HelpTooltip from "./HelpTooltip";
import { isFeatureEnabled } from "../lib/featureFlags";
import useFeatureUsage from "../lib/useFeatureUsage";
import Trades from "../routes/Trades";

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
} from "@heroicons/react/24/outline";

const GuestCRM = lazy(() => import("./GuestCRM"));
const GuestChat = lazy(() => import("./GuestChat"));

const departmentNav = {
  finance: [
    { label: "Assets", icon: BuildingOfficeIcon },
    { label: "Inspections", icon: ClipboardDocumentListIcon },
    { label: "Dashboard", icon: HomeIcon }, // "/"
    { label: "Loans", icon: BanknotesIcon },
    { label: "Draws", icon: ClipboardDocumentListIcon },
    { label: "Projects", icon: BriefcaseIcon },
    { label: "Organizations", icon: BuildingOfficeIcon },
    { label: "Invites", icon: UserGroupIcon },
    { label: "Document Review", icon: DocumentTextIcon },
    { label: "SSO", icon: Cog6ToothIcon },
    { label: "Reports", icon: ChartBarIcon },
    { label: "Menu", icon: ClipboardDocumentListIcon },
    { label: "Orders", icon: ClipboardDocumentListIcon },
    { label: "Payments", icon: CurrencyDollarIcon },
    { label: "Trades", icon: ArrowsRightLeftIcon, flag: "trading" },
    { label: "Exchange", icon: ArrowsRightLeftIcon },
    { label: "Analytics", icon: ChartPieIcon },
    { label: "Restaurant Ops", icon: PresentationChartLineIcon },
    { label: "Applications", icon: DocumentPlusIcon },
    { label: "Risk", icon: ChartBarSquareIcon },
    { label: "Servicing", icon: WrenchScrewdriverIcon },
    { label: "Webhooks", icon: Cog6ToothIcon },
    { label: "Subscriptions", icon: Cog6ToothIcon },
  ],
};

const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
const toPath = (label) => (label === "Dashboard" ? "/" : `/${slug(label)}`);

const Placeholder = ({ title }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
    <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
    <p className="mt-2 text-slate-600">Placeholder. Connect this when ready.</p>
  </div>
);

export default function DashboardLayout() {
  const { session, supabase } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [department] = useState("finance"); // screenshot is finance
  const navItems = departmentNav[department];

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const { usage, recordUsage } = useFeatureUsage();

  const frequentItems = navItems
    .filter((i) => usage[i.label])
    .sort((a, b) => usage[b.label] - usage[a.label])
    .slice(0, 3);

  useEffect(() => {
    if (location.pathname === "" || location.pathname === "/") return;
    // Always land on the main dashboard like the pic
    navigate("/");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderItem = (item) => {
    const path = toPath(item.label);
    const Icon = item.icon;
    const active = location.pathname === path || (path === "/" && location.pathname === "/");
    const base = "group flex items-center w-full gap-3 rounded-md px-3 py-2 text-sm font-medium";
    const state = active
      ? "bg-slate-800 text-white"
      : "text-slate-300 hover:bg-slate-800 hover:text-white focus:bg-slate-800 focus:text-white active:bg-slate-900";

    return (
      <div key={item.label}>
        <Link
          to={path}
          className={`${base} ${state}`}
          title={item.label}
          onClick={() => recordUsage(item.label)}
        >
          {Icon && <Icon className="h-5 w-5 shrink-0" />}
          {sidebarOpen && <span className="truncate">{item.label}</span>}
        </Link>
      </div>
    );
  };

  const pages = {
    Dashboard: () => <DashboardHome />,
    Loans: () => <LoansDashboard />,
    "New Application": () => <LoanApplicationForm onSubmitted={() => setRefreshKey((k) => k + 1)} />,
    "Application List": () => <LoanApplicationList key={refreshKey} />,
    "Underwriting Board": () => <UnderwritingBoard />,
    Decisions: () => <DecisionTimeline />,
    "Payment Portal": () => <PaymentPortal />,
    "Self Service Payment": () => <SelfServicePayment />,
    "Prepayment Calculator": () => <PayoffCalculator />,
    Reports: () => <ReportBuilder />,
    "Investor Reports": () => (
      <>
        <InvestorReportForm onCreated={() => setRefreshKey((k) => k + 1)} />
        <InvestorReportsList refresh={refreshKey} />
      </>
    ),
    "Market Analysis": () => <MarketAnalysis />,
    "Live Analytics": () => <RealTimeAnalyticsDashboard />,
    Trades: () => <Trades />,
    "Asset Management": () => <AssetManagement />,
    Settings: () => <OrganizationSettings />,
  };

  const ensurePage = (label) => pages[label] || (() => <Placeholder title={label} />);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-100 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "md:w-64" : "md:w-20"} w-full bg-slate-950 text-slate-100 flex flex-col transition-all`}
        aria-label="Main navigation"
      >
        {/* Brand exactly like the pic */}
        <div className="px-4 py-4 flex items-center gap-3 border-b border-slate-800">
         <img src="/logo-dark.png" alt="Kontra" className="h-6 w-auto" />
          {sidebarOpen && <span className="text-sm font-semibold">Dashboard</span>}
          <button
            onClick={() => setSidebarOpen((o) => !o)}
            className="ml-auto text-slate-400 hover:text-white"
            title="Toggle sidebar"
          >
            ▸
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {frequentItems.length > 0 && (
            <div className="mb-2 space-y-1">
              {frequentItems.map(renderItem)}
              <hr className="border-slate-800" />
            </div>
          )}
          {departmentNav.finance.map(renderItem)}
          <button
            onClick={() => supabase.auth.signOut()}
            className="group mt-2 flex items-center w-full gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5 shrink-0" />
            {sidebarOpen && <span className="truncate">Log Out</span>}
          </button>
        </nav>
      </aside>

      {/* Header + Content */}
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
              {session?.user?.email?.[0]?.toUpperCase() ?? ""}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          <Routes>
            <Route path="/" element={<DashboardHome />} />
            {departmentNav.finance.map((i) => (
              <Route key={i.label} path={toPath(i.label)} element={ensurePage(i.label)()} />
            ))}
          </Routes>
        </main>
      </div>

      {/* Right rail */}
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
