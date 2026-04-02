import {
  Cog6ToothIcon,
  ShieldCheckIcon,
  CubeTransparentIcon,
  QueueListIcon,
  ArchiveBoxIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";

export const lenderNavRoutes = [
  {
    label: "Pipeline",
    path: "/dashboard",
    icon: QueueListIcon,
    requiresAuth: true,
  },
  {
    label: "Asset Library",
    path: "/portfolio",
    icon: ArchiveBoxIcon,
    requiresAuth: true,
  },
  {
    label: "Verification",
    path: "/servicing",
    icon: ShieldCheckIcon,
    requiresAuth: true,
  },
  {
    label: "Compliance",
    path: "/governance",
    icon: ScaleIcon,
    requiresAuth: true,
  },
  {
    label: "Token Readiness",
    path: "/markets",
    icon: CubeTransparentIcon,
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
