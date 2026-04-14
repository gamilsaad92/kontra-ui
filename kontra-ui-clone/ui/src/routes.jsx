import {
  HomeIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  LinkIcon,
  GlobeAltIcon,
  PresentationChartLineIcon,
  CubeTransparentIcon,
  CreditCardIcon,
  BoltIcon,
  UsersIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  DocumentMagnifyingGlassIcon,
  BuildingOfficeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";

export const lenderNavRoutes = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: HomeIcon,
    requiresAuth: true,
  },
  {
    label: "Portfolio",
    path: "/portfolio",
    icon: BanknotesIcon,
    requiresAuth: true,
  },
  {
    label: "Compliance & Legal",
    path: "/governance",
    icon: ShieldCheckIcon,
    requiresAuth: true,
  },
  {
    label: "Capital Markets",
    path: "/markets",
    icon: PresentationChartLineIcon,
    requiresAuth: true,
  },
  {
    label: "Tokenization",
    path: "/onchain",
    icon: CubeTransparentIcon,
    requiresAuth: true,
  },
  {
    label: "Risk Intelligence",
    path: "/analytics",
    icon: ChartPieIcon,
    requiresAuth: true,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: ChartBarIcon,
    requiresAuth: true,
  },
  {
    label: "Workflow Engine",
    path: "/workflow",
    icon: BoltIcon,
    requiresAuth: true,
  },
  {
    label: "Integration Hub",
    path: "/integration",
    icon: LinkIcon,
    requiresAuth: true,
  },
  {
    label: "Enterprise API",
    path: "/enterprise-api",
    icon: GlobeAltIcon,
    requiresAuth: true,
  },
  {
    label: "Policy Engine",
    path: "/policy",
    icon: ShieldCheckIcon,
    requiresAuth: true,
  },
  {
    label: "Agent Console",
    path: "/agents",
    icon: SparklesIcon,
    requiresAuth: true,
  },
  {
    label: "Team & Roles",
    path: "/settings/team",
    icon: UsersIcon,
    requiresAuth: true,
  },
  {
    label: "Billing",
    path: "/settings/billing",
    icon: CreditCardIcon,
    requiresAuth: true,
  },
  {
    label: "Settings",
    path: "/settings/sso",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
];

export const servicerNavRoutes = [
  {
    label: "Overview",
    path: "/servicer/overview",
    icon: HomeIcon,
    requiresAuth: true,
  },
  {
    label: "Payments",
    path: "/servicer/payments",
    icon: CurrencyDollarIcon,
    requiresAuth: true,
  },
  {
    label: "Inspections",
    path: "/servicer/inspections",
    icon: MagnifyingGlassIcon,
    requiresAuth: true,
  },
  {
    label: "Draws",
    path: "/servicer/draws",
    icon: BanknotesIcon,
    requiresAuth: true,
  },
  {
    label: "Escrows",
    path: "/servicer/escrow",
    icon: BuildingOfficeIcon,
    requiresAuth: true,
  },
  {
    label: "Borrower Financials",
    path: "/servicer/borrower-financials",
    icon: DocumentMagnifyingGlassIcon,
    requiresAuth: true,
  },
  {
    label: "Management",
    path: "/servicer/management",
    icon: WrenchScrewdriverIcon,
    requiresAuth: true,
  },
  {
    label: "AI Operations",
    path: "/servicer/ai-ops",
    icon: SparklesIcon,
    requiresAuth: true,
  },
];

export const lenderDefaultPath = "/dashboard";
export const servicerDefaultPath = "/servicer/overview";
