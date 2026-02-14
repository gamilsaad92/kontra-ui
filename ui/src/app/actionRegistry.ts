export type ApiMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE" | "HEAD";

export type ActionRegistryItem = {
  id: string;
  route: string;
  uiSelector?: string;
  requiredApis: string[];
  primaryActions: Array<{ name: string; method: ApiMethod; path: string }>;
  featureFlag?: string;
};

export const actionRegistry: ActionRegistryItem[] = [
  {
    id: "dashboard.summary",
    route: "/dashboard",
    requiredApis: ["GET /api/dashboard/summary"],
    primaryActions: [],
  },
  {
    id: "portfolio.loans",
    route: "/portfolio/loans",
    requiredApis: ["GET /api/loans"],
    primaryActions: [
      { name: "create-loan", method: "POST", path: "/api/loans" },
      { name: "update-loan", method: "PUT", path: "/api/loans/:loanId" },
    ],
  },
  {
    id: "portfolio.projects",
    route: "/portfolio/projects",
    requiredApis: ["GET /api/projects"],
    primaryActions: [{ name: "create-project", method: "POST", path: "/api/projects" }],
  },
  { id: "servicing.overview", route: "/servicing/overview", requiredApis: ["GET /api/servicing/insights"], primaryActions: [] },
  { id: "servicing.loans", route: "/servicing/loans", requiredApis: ["GET /api/loans"], primaryActions: [] },
  { id: "servicing.draws", route: "/servicing/draws", requiredApis: ["GET /api/draw-requests"], primaryActions: [{ name: "create-draw", method: "POST", path: "/api/draw-requests" }] },
  { id: "servicing.inspections", route: "/servicing/inspections", requiredApis: ["GET /api/inspections"], primaryActions: [{ name: "schedule-inspection", method: "POST", path: "/api/inspections/schedule" }] },
  { id: "servicing.financials", route: "/servicing/borrower-financials", requiredApis: ["POST /api/servicing/financials/analyze"], primaryActions: [{ name: "analyze-financials", method: "POST", path: "/api/servicing/financials/analyze" }] },
  { id: "servicing.escrow", route: "/servicing/escrow", requiredApis: ["GET /api/escrows"], primaryActions: [{ name: "escrow-payment", method: "POST", path: "/api/loans/:loanId/escrow/pay" }] },
  { id: "servicing.management", route: "/servicing/management", requiredApis: ["GET /api/loans"], primaryActions: [] },
  { id: "servicing.aiValidation", route: "/servicing/ai-validation", requiredApis: ["GET /api/ai/reviews"], primaryActions: [{ name: "create-ai-review", method: "POST", path: "/api/ai/payments/review" }] },
  { id: "servicing.payments", route: "/servicing/payments", requiredApis: ["GET /api/payments"], primaryActions: [{ name: "create-payment", method: "POST", path: "/api/payments" }, { name: "review-payment", method: "POST", path: "/api/ai/payments/review" }] },
  { id: "markets.pools", route: "/markets/pools", requiredApis: ["GET /api/marketplace"], primaryActions: [{ name: "create-pool", method: "POST", path: "/api/marketplace" }] },
  { id: "markets.tokens", route: "/markets/tokens", requiredApis: ["GET /api/capital-markets/tokens"], primaryActions: [{ name: "create-token", method: "POST", path: "/api/capital-markets/tokens" }] },
  { id: "markets.trades", route: "/markets/trades", requiredApis: ["GET /api/trades"], primaryActions: [{ name: "create-trade", method: "POST", path: "/api/trades" }] },
  { id: "markets.exchange", route: "/markets/exchange", requiredApis: ["GET /api/exchange/listings"], primaryActions: [{ name: "create-listing", method: "POST", path: "/api/exchange/listings" }] },
  { id: "governance.compliance", route: "/governance/compliance", requiredApis: ["POST /api/regulatory-scan"], primaryActions: [{ name: "run-regulatory-scan", method: "POST", path: "/api/regulatory-scan" }] },
  { id: "governance.policyPacks", route: "/governance/policy/packs", requiredApis: ["GET /api/policy/packs"], primaryActions: [{ name: "create-policy-pack", method: "POST", path: "/api/policy/packs" }] },
  { id: "governance.policyRules", route: "/governance/policy/rules", requiredApis: ["GET /api/policy/rules"], primaryActions: [{ name: "create-policy-rule", method: "POST", path: "/api/policy/rules" }] },
  { id: "governance.findings", route: "/governance/policy/findings", requiredApis: ["GET /api/policy/findings"], primaryActions: [{ name: "create-finding", method: "POST", path: "/api/policy/findings" }] },
  { id: "governance.legal", route: "/governance/legal", requiredApis: ["GET /api/legal/config"], primaryActions: [{ name: "save-legal-config", method: "POST", path: "/api/legal/config" }] },
  { id: "governance.documentReview", route: "/governance/document-review", requiredApis: ["POST /api/document-review/process"], primaryActions: [{ name: "run-document-review", method: "POST", path: "/api/document-review/process" }] },
  { id: "governance.risk", route: "/governance/risk", requiredApis: ["GET /api/risk/summary"], primaryActions: [] },
  { id: "analytics.insights", route: "/analytics", requiredApis: ["GET /api/analytics/orders"], primaryActions: [] },
  { id: "reports.builder", route: "/reports", requiredApis: ["GET /api/reports"], primaryActions: [{ name: "run-report", method: "POST", path: "/api/reports/run" }, { name: "export-report", method: "GET", path: "/api/reports/export" }] },
  { id: "organizations.settings", route: "/organizations", requiredApis: ["GET /api/organizations"], primaryActions: [{ name: "create-organization", method: "POST", path: "/api/organizations" }] },
  { id: "settings.sso", route: "/settings/sso", requiredApis: ["GET /api/sso/config"], primaryActions: [{ name: "save-sso-config", method: "POST", path: "/api/sso/config" }] },
];

export const actionRegistryByRoute = new Map(actionRegistry.map((item) => [item.route, item]));
