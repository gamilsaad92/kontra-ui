import {
  HomeIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ChartPieIcon,
  WrenchScrewdriverIcon,
  ShieldCheckIcon,
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
