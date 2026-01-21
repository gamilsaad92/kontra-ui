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
import ExecutiveDashboard from "./components/ExecutiveDashboard";
import PoolingWorkspace from "./routes/PoolingWorkspace";
import LegalConfiguration from "./routes/LegalConfiguration";
import LoanApplicationList from "./components/LoanApplicationList";
import OrganizationSettings from "./components/OrganizationSettings";
import StaffRestaurantDashboard from "./components/StaffRestaurantDashboard";
import Integrations from "./routes/Integrations";
import OlbCouponPage from "./pages/OlbCouponPage";

import {
  HomeIcon,
  BuildingOfficeIcon,
  BanknotesIcon,
  BriefcaseIcon,
  DocumentTextIcon,
  DocumentCheckIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
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
    label: "Executive",
    icon: ChartBarIcon,
    component: ExecutiveDashboard,
    requiresAuth: true,
    roles: ["exec"],
  },
  {
    label: "Assets",
    icon: BuildingOfficeIcon,
    component: AssetManagement,
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
    label: "OLB Coupon",
    icon: DocumentTextIcon,
    component: OlbCouponPage,
    requiresAuth: true,
    flag: "olb-coupon",
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
       path: "/dashboard/servicing",
    children: [
      {
        label: "Draws",
        component: DrawsDashboard,
        requiresAuth: true,
        path: "/dashboard/servicing/draws",
      },
      {
        label: "Inspections",
        component: Inspections,
        requiresAuth: true,
        path: "/dashboard/servicing/inspections",
      },
      {
        label: "Payments",
        component: PaymentPortal,
        requiresAuth: true,
        path: "/dashboard/servicing/payments",
      },
    ],
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
