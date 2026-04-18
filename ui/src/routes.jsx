import {
    HomeIcon,
    BanknotesIcon,
    Cog6ToothIcon,
    ChartBarIcon,
    ShieldCheckIcon,
    LinkIcon,
    CubeTransparentIcon,
    SparklesIcon,
    UsersIcon,
    CurrencyDollarIcon,
    CommandLineIcon,
    BuildingOfficeIcon,
    ShoppingBagIcon,
    DocumentChartBarIcon,
    MagnifyingGlassIcon,
    WrenchScrewdriverIcon,
    DocumentMagnifyingGlassIcon,
    FolderOpenIcon,
    ArrowPathIcon,
  } from "@heroicons/react/24/outline";

  /**
   * Lender portal navigation — clean IA matching the Kontra pitch narrative.
   * Dashboard → Loans → Servicing → AI Copilot → Command Center →
   * Compliance & Rules → Integrations → Tokenization → Marketplace → Reports
   * Admin items grouped at bottom.
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
      path: "/portfolio",
      icon: BanknotesIcon,
      requiresAuth: true,
    },
    {
      label: "Servicing",
      path: "/servicer/overview",
      icon: BuildingOfficeIcon,
      requiresAuth: true,
    },
    {
      label: "Document Vault",
      path: "/document-vault",
      icon: FolderOpenIcon,
      requiresAuth: true,
    },
    {
      label: "Loan Lifecycle",
      path: "/loan-lifecycle",
      icon: ArrowPathIcon,
      requiresAuth: true,
    },
    {
      label: "AI Copilot",
      path: "/ai-copilot",
      icon: SparklesIcon,
      requiresAuth: true,
    },
    {
      label: "Command Center",
      path: "/command-center",
      icon: CommandLineIcon,
      requiresAuth: true,
    },
    {
      label: "Compliance & Rules",
      path: "/policy",
      icon: ShieldCheckIcon,
      requiresAuth: true,
    },
    {
      label: "Integrations",
      path: "/integration",
      icon: LinkIcon,
      requiresAuth: true,
    },
    {
      label: "Tokenization",
      path: "/tokenization",
      icon: CubeTransparentIcon,
      requiresAuth: true,
    },
    {
      label: "Marketplace",
      path: "/markets",
      icon: ShoppingBagIcon,
      requiresAuth: true,
    },
    {
      label: "Reports",
      path: "/reports",
      icon: DocumentChartBarIcon,
      requiresAuth: true,
    },
    // ── Admin (grouped at bottom) ──────────────────────────────────────────
    {
      label: "Team & Roles",
      path: "/settings/team",
      icon: UsersIcon,
      requiresAuth: true,
      group: "admin",
    },
    {
      label: "Cost Intelligence",
      path: "/cost-governance",
      icon: CurrencyDollarIcon,
      requiresAuth: true,
      group: "admin",
    },
    {
      label: "Settings",
      path: "/settings/billing",
      icon: Cog6ToothIcon,
      requiresAuth: true,
      group: "admin",
    },
  ];

  export const lenderDefaultPath = "/dashboard";

  /**
   * Servicer portal navigation
   */
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

  export const servicerDefaultPath = "/servicer/overview";
  