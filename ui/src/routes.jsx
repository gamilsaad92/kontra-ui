
import PortfolioOverview from "./pages/lender/PortfolioOverview";
import AssetManagement from "./routes/AssetManagement";
import Inspections from "./routes/Inspections";
import Trades from "./routes/Trades";
import Exchange from "./routes/Exchange";
import LoansDashboard from "./components/LoansDashboard";
import DrawsDashboard from "./components/DrawsDashboard";
import ProjectsTable from "./components/ProjectsTable";
import DocumentReview from "./components/DocumentReview";
import PaymentPortal from "./components/PaymentPortal";
import ReportBuilder from "./components/ReportBuilder";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import RiskDashboard from "./components/RiskDashboard";
import ServicingDashboard from "./components/ServicingDashboard";
import WebhooksManager from "./components/WebhooksManager";
import LoanApplicationList from "./components/LoanApplicationList";
import OrganizationSettings from "./components/OrganizationSettings";
import StaffRestaurantDashboard from "./components/StaffRestaurantDashboard";

import {
  HomeIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  BriefcaseIcon,
  UserGroupIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  PresentationChartLineIcon,
  DocumentPlusIcon,
  ChartBarSquareIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export const lenderNavRoutes = [
  {
    label: "Dashboard",
    path: "/",
    icon: HomeIcon,
    component: PortfolioOverview,
    requiresAuth: true,
  },
  {
    label: "Assets",
    icon: BuildingOfficeIcon,
    component: AssetManagement,
    requiresAuth: true,
  },
  {
    label: "Inspections",
    icon: ClipboardDocumentListIcon,
    component: Inspections,
    requiresAuth: true,
  },
  {
    label: "Loans",
    icon: BanknotesIcon,
    component: LoansDashboard,
    requiresAuth: true,
  },
  {
    label: "Draws",
    icon: ClipboardDocumentListIcon,
    component: DrawsDashboard,
    requiresAuth: true,
  },
  {
    label: "Projects",
    icon: BriefcaseIcon,
    component: ProjectsTable,
    requiresAuth: true,
  },
  {
    label: "Organizations",
    icon: BuildingOfficeIcon,
    component: OrganizationSettings,
    requiresAuth: true,
  },
  {
    label: "Invites",
    icon: UserGroupIcon,
    requiresAuth: true,
  },
  {
    label: "Document Review",
    icon: DocumentTextIcon,
    component: DocumentReview,
    requiresAuth: true,
  },
  {
    label: "SSO",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
  {
    label: "Reports",
    icon: ChartBarIcon,
    component: ReportBuilder,
    requiresAuth: true,
  },
  {
    label: "Menu",
    icon: ClipboardDocumentListIcon,
    requiresAuth: true,
  },
  {
    label: "Orders",
    icon: ClipboardDocumentListIcon,
    requiresAuth: true,
  },
  {
    label: "Payments",
    icon: CurrencyDollarIcon,
    component: PaymentPortal,
    requiresAuth: true,
  },
  {
    label: "Trades",
    icon: ArrowsRightLeftIcon,
    component: Trades,
    requiresAuth: true,
    flag: "trading",
  },
  {
    label: "Exchange",
    icon: ArrowsRightLeftIcon,
    component: Exchange,
    requiresAuth: true,
  },
  {
    label: "Analytics",
    icon: ChartPieIcon,
    component: AnalyticsDashboard,
    requiresAuth: true,
  },
  {
    label: "Restaurant Ops",
    icon: PresentationChartLineIcon,
    component: StaffRestaurantDashboard,
    requiresAuth: true,
  },
  {
    label: "Applications",
    icon: DocumentPlusIcon,
    component: LoanApplicationList,
    requiresAuth: true,
  },
  {
    label: "Risk",
    icon: ChartBarSquareIcon,
    component: RiskDashboard,
    requiresAuth: true,
  },
  {
    label: "Servicing",
    icon: WrenchScrewdriverIcon,
    component: ServicingDashboard,
    requiresAuth: true,
  },
  {
    label: "Webhooks",
    icon: Cog6ToothIcon,
    component: WebhooksManager,
    requiresAuth: true,
  },
  {
    label: "Subscriptions",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
];

export const lenderDefaultPath = "/";
