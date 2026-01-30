import {
  HomeIcon,
  BuildingOfficeIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
  BuildingLibraryIcon,
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
   label: "Capital Markets",
    path: "/markets",
    icon: BuildingLibraryIcon,
    requiresAuth: true,
    children: [
      { label: "Pools", path: "/markets/pools" },
      { label: "Tokens", path: "/markets/tokens" },
      { label: "Trades", path: "/markets/trades" },
      { label: "Exchange", path: "/markets/exchange" },
      { label: "Distribution", path: "/markets/distribution" },
    ],
 },
  {
    label: "On-Chain",
     path: "/onchain",
    icon: CubeTransparentIcon,
    requiresAuth: true,
  },
  {
    label: "Compliance & Legal",
    path: "/governance",
    icon: ShieldCheckIcon,
    requiresAuth: true,
  },
  {
    label: "Organizations",
    path: "/organizations",
    icon: BuildingOfficeIcon,
    requiresAuth: true,
  },
  {
    label: "AI Insights",
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
