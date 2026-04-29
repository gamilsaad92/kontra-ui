import {
  HomeIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  PresentationChartLineIcon,
  CreditCardIcon,
  UsersIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  DocumentMagnifyingGlassIcon,
  BuildingOfficeIcon,
  SparklesIcon,
  ExclamationTriangleIcon,
  CubeTransparentIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";

/**
 * LENDER PORTAL NAV
 * Matches the kontraplatform.com Lender dashboard nav structure.
 */
export const lenderNavRoutes = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: HomeIcon,
    requiresAuth: true,
  },
  {
    label: "Loans",
    path: "/portfolio/loans",
    icon: BanknotesIcon,
    requiresAuth: true,
  },
  {
    label: "Servicing",
    path: "/servicer/overview",
    icon: WrenchScrewdriverIcon,
    requiresAuth: true,
  },
  {
    label: "AI Copilot",
    path: "/analytics",
    icon: SparklesIcon,
    requiresAuth: true,
  },
  {
    label: "Portfolio Forecast",
    path: "/portfolio/overview",
    icon: PresentationChartLineIcon,
    requiresAuth: true,
  },
  {
    label: "Alert Center",
    path: "/compliance-center",
    icon: ExclamationTriangleIcon,
    requiresAuth: true,
  },
  {
    label: "Compliance & Rules",
    path: "/governance",
    icon: ShieldCheckIcon,
    requiresAuth: true,
  },
  {
    label: "Integrations",
    path: "/integration",
    icon: CubeTransparentIcon,
    requiresAuth: true,
  },
  {
    label: "Tokenization",
    path: "/onchain",
    icon: CubeTransparentIcon,
    requiresAuth: true,
  },
  {
    label: "Marketplace",
    path: "/markets",
    icon: BuildingOfficeIcon,
    requiresAuth: true,
  },
  {
    label: "Reports",
    path: "/reports",
    icon: ChartBarIcon,
    requiresAuth: true,
  },
  {
    label: "Team & Roles",
    path: "/settings/team",
    icon: UsersIcon,
    requiresAuth: true,
  },
  {
    label: "Cost Intelligence",
    path: "/cost-governance",
    icon: CurrencyDollarIcon,
    requiresAuth: true,
  },
  {
    label: "Settings",
    path: "/settings/sso",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
];

/**
 * SERVICER PORTAL NAV
 * 10 items covering every Freddie Mac / Fannie Mae servicer function.
 * Outer sidebar in sync with ServicingLayout inner tabs.
 */
export const servicerNavRoutes = [
  {
    label: "Cases",
    path: "/servicer/cases",
    icon: ClipboardDocumentListIcon,
    requiresAuth: true,
  },
  {
    label: "Overview",
    path: "/servicer/overview",
    icon: HomeIcon,
    requiresAuth: true,
  },
  {
    label: "Cash Flow",
    path: "/servicer/waterfall",
    icon: ChartBarIcon,
    requiresAuth: true,
  },
  {
    label: "Payments",
    path: "/servicer/payments",
    icon: CurrencyDollarIcon,
    requiresAuth: true,
  },
  {
    label: "Delinquency",
    path: "/servicer/delinquency",
    icon: ExclamationTriangleIcon,
    requiresAuth: true,
  },
  {
    label: "Draws",
    path: "/servicer/draws",
    icon: BanknotesIcon,
    requiresAuth: true,
  },
  {
    label: "Inspections",
    path: "/servicer/inspections",
    icon: MagnifyingGlassIcon,
    requiresAuth: true,
  },
  {
    label: "Escrow",
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
    label: "Management (PMC)",
    path: "/servicer/management",
    icon: WrenchScrewdriverIcon,
    requiresAuth: true,
  },
  {
    label: "Review Queue",
    path: "/servicer/ai-ops",
    icon: SparklesIcon,
    requiresAuth: true,
  },
];

export const lenderDefaultPath = "/dashboard";
export const servicerDefaultPath = "/servicer/cases";
