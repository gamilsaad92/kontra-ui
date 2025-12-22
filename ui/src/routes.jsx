import AssetManagement from "./routes/AssetManagement";
import DashboardPage from "./components/DashboardPage";
import Inspections from "./routes/Inspections";
import Trades from "./routes/Trades";
import Exchange from "./routes/Exchange";
import Compliance from "./routes/Compliance";
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
import OnchainDashboard from "./components/OnchainDashboard";
import PoolingWorkspace from "./routes/PoolingWorkspace";
import LoanApplicationList from "./components/LoanApplicationList";
import OrganizationSettings from "./components/OrganizationSettings";
import StaffRestaurantDashboard from "./components/StaffRestaurantDashboard";
import Integrations from "./routes/Integrations";

import {
  HomeIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  ChartPieIcon,
  DocumentPlusIcon,
  ChartBarSquareIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
  CubeTransparentIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

export const lenderNavRoutes = [
  {
    label: "Dashboard",
    path: "/",
    icon: HomeIcon,
   component: DashboardPage,
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
    label: "Pools & Tokens",
    icon: BuildingLibraryIcon,
    component: PoolingWorkspace,
    requiresAuth: true,
   },
  {
    label: "On-Chain",
    icon: CubeTransparentIcon,
    component: OnchainDashboard,
    requiresAuth: true,
  },
   {
    label: "Legal",
    icon: DocumentCheckIcon,
    component: LegalConfiguration,
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
    label: "Applications",
    icon: DocumentPlusIcon,
    component: LoanApplicationList,
    requiresAuth: true,
  },
  {
    label: "Compliance",
    icon: ShieldCheckIcon,
    component: Compliance,
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
    label: "Integrations",
    icon: BoltIcon,
    component: Integrations,
    requiresAuth: true,
  },
  {
    label: "Subscriptions",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
];

export const lenderDefaultPath = "/";
