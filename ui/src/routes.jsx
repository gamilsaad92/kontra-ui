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
} from "@heroicons/react/24/outline";

/**
 * LENDER PORTAL NAV
 * 7 items reflecting true lender functions in CRE loan servicing.
 * Aligned with FDIC, Freddie Mac, and Fannie Mae operational roles.
 */
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
    label: "Compliance & Governance",
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
    label: "Team & Roles",
    path: "/settings/team",
    icon: UsersIcon,
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
export const servicerDefaultPath = "/servicer/overview";
