import {
  HomeIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  PresentationChartLineIcon,
  CubeTransparentIcon,
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
    label: "Servicing",
    path: "/servicing",
    icon: WrenchScrewdriverIcon,
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
    label: "Settings",
    path: "/settings/sso",
    icon: Cog6ToothIcon,
    requiresAuth: true,
  },
];

export const lenderDefaultPath = "/dashboard";
