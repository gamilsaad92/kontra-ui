import type { RestoreFlag } from "./flags";

export type Severity = "blocker" | "high" | "medium";

export type ActionRegistryItem = {
  id: string;
  label: string;
  route: string;
 uiPath: string;
  requiredApis: string[];
  requiredRoutes?: string[];
  featureFlag?: RestoreFlag;
  severity: Severity;
};

export const actionRegistry: ActionRegistryItem[] = [
  {
    id: "dashboard.summary",
    label: "Dashboard > Summary",
    route: "/dashboard",
     uiPath: "ui/src/components/SaasDashboardHome.tsx",
    requiredApis: ["GET /api/dashboard/summary"],
   requiredRoutes: ["/dashboard"],
    severity: "blocker",
  },
  {
    id: "portfolio.loans.list",
    label: "Portfolio > Loans list",
    route: "/portfolio/loans",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/portfolio/loans", "POST /api/portfolio/loans"],
    requiredRoutes: ["/portfolio", "/portfolio/loans"],
    featureFlag: "RESTORE_OLD_PORTFOLIO",
    severity: "blocker",
  },
  {
    id: "portfolio.assets.list",
    label: "Portfolio > Assets list",
    route: "/portfolio/assets",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/portfolio/assets", "POST /api/portfolio/assets"],
    requiredRoutes: ["/portfolio/assets"],
    featureFlag: "RESTORE_OLD_PORTFOLIO",
    severity: "blocker",
  },
  {
    id: "servicing.payments.list",
    label: "Servicing > Payments",
    route: "/servicing/payments",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/payments", "POST /api/servicing/payments"],
    requiredRoutes: ["/servicing/payments"],
    featureFlag: "RESTORE_OLD_SERVICING",
    severity: "blocker",
  },
  {
    id: "servicing.inspections.list",
    label: "Servicing > Inspections",
    route: "/servicing/inspections",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/inspections", "POST /api/servicing/inspections"],
    requiredRoutes: ["/servicing/inspections"],
    featureFlag: "RESTORE_OLD_SERVICING",
    severity: "blocker",
  },
  {
    id: "servicing.draws.list",
    label: "Servicing > Draws",
    route: "/servicing/draws",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/draws", "POST /api/servicing/draws"],
    requiredRoutes: ["/servicing/draws"],
    featureFlag: "RESTORE_OLD_SERVICING",
    severity: "blocker",
  },
  {
    id: "servicing.escrow.list",
    label: "Servicing > Escrow",
    route: "/servicing/escrow",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/escrows", "POST /api/servicing/escrows"],
    requiredRoutes: ["/servicing/escrow"],
    featureFlag: "RESTORE_OLD_SERVICING",
    severity: "high",
  },
  {
    id: "servicing.borrowerFinancials.list",
    label: "Servicing > Borrower Financials",
    route: "/servicing/borrower-financials",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/borrower-financials", "POST /api/servicing/borrower-financials"],
    requiredRoutes: ["/servicing/borrower-financials"],
    featureFlag: "RESTORE_OLD_SERVICING",
    severity: "high",
  },
  {
    id: "servicing.management.list",
    label: "Servicing > Management",
    route: "/servicing/management",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/servicing/management", "POST /api/servicing/management"],
    requiredRoutes: ["/servicing/management"],
     featureFlag: "RESTORE_OLD_SERVICING",
    severity: "high",
  },
  {
    id: "markets.pools.list",
    label: "Capital Markets > Pools",
    route: "/markets/pools",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/markets/pools", "POST /api/markets/pools", "POST /api/markets/pools/:id/loans"],
    requiredRoutes: ["/markets/pools"],
    featureFlag: "RESTORE_OLD_MARKETS",
    severity: "blocker",
  },
  {
    id: "markets.tokens.list",
    label: "Capital Markets > Tokens",
    route: "/markets/tokens",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/markets/tokens", "POST /api/markets/tokens"],
    requiredRoutes: ["/markets/tokens"],
    featureFlag: "RESTORE_OLD_MARKETS",
    severity: "high",
  },
  {
    id: "markets.trades.list",
    label: "Capital Markets > Trades",
    route: "/markets/trades",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/markets/trades", "POST /api/markets/trades"],
    requiredRoutes: ["/markets/trades"],
    featureFlag: "RESTORE_OLD_MARKETS",
    severity: "high",
  },
  {
    id: "governance.compliance.list",
    label: "Governance > Compliance",
    route: "/governance/compliance",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/governance/compliance-items", "POST /api/governance/compliance-items"],
    requiredRoutes: ["/governance/compliance"],
    featureFlag: "RESTORE_OLD_GOVERNANCE",
    severity: "high",
  },
  {
    id: "governance.legal.list",
    label: "Governance > Legal",
    route: "/governance/legal",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/governance/legal-items", "POST /api/governance/legal-items"],
    requiredRoutes: ["/governance/legal"],
    featureFlag: "RESTORE_OLD_GOVERNANCE",
    severity: "high",
  },
  {
    id: "governance.regulatoryScans.list",
    label: "Governance > Regulatory Scans",
    route: "/governance/regulatory-scans",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/governance/regulatory-scans", "POST /api/governance/regulatory-scans"],
    requiredRoutes: ["/governance/regulatory-scans"],
    featureFlag: "RESTORE_OLD_GOVERNANCE",
    severity: "high",
  },
  {
    id: "governance.documentReviews.list",
    label: "Governance > Document Reviews",
    route: "/governance/document-review",
    uiPath: "ui/src/pages/dashboard/canonical/pages.tsx",
    requiredApis: ["GET /api/governance/document-reviews", "POST /api/governance/document-reviews"],
    requiredRoutes: ["/governance/document-review"],
    featureFlag: "RESTORE_OLD_REPORTS",
    severity: "high",
  },
 ];
 
export const actionRegistryByRoute = new Map(actionRegistry.map((item) => [item.route, item]));
