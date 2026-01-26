import type {
  InsightItem,
  RiskDriver,
  TrendMover,
  Anomaly,
  Recommendation,
} from "../types";

const insights: InsightItem[] = [
  {
    id: "insight-delinquency",
    title: "3 loans show rising delinquency probability in the next 30 days",
    confidence: 0.86,
    severity: "high",
    category: "Servicing",
    windowDays: 30,
    drivers: [
      "Two borrowers missed the last escrow replenishment window",
      "Cash balance coverage down 14% week-over-week",
      "Payment reminders ignored twice in the last 10 days",
    ],
    evidenceLinks: [
      { label: "Servicing watchlist", href: "/servicing/loans" },
      { label: "Collections log", href: "/reports" },
    ],
    actions: [
      { label: "Create task", href: "/servicing/management" },
      { label: "Open in Servicing", href: "/servicing/loans" },
    ],
  },
  {
    id: "insight-escrow",
    title: "Escrow balances trending below target on 2 assets",
    confidence: 0.78,
    severity: "medium",
    category: "Compliance",
    windowDays: 30,
    drivers: [
      "Tax reserve draw posted early for Q3",
      "Insurance premiums escalated +9% without offsetting reserves",
    ],
    evidenceLinks: [
      { label: "Escrow reconciliation", href: "/servicing/escrow" },
    ],
    actions: [
      { label: "Create task", href: "/servicing/management" },
    ],
  },
  {
    id: "insight-dscr",
    title: "Borrower financials show DSCR compression on 4 properties",
    confidence: 0.82,
    severity: "high",
    category: "Servicing",
    windowDays: 90,
    drivers: [
      "NOI down 6% across multifamily exposure",
      "Occupancy dipped below 92% for 3 consecutive months",
    ],
    evidenceLinks: [
      { label: "Borrower uploads", href: "/servicing/borrower-financials" },
      { label: "DSCR trend report", href: "/reports" },
    ],
    actions: [
      { label: "Create task", href: "/servicing/management" },
      { label: "Open in Servicing", href: "/servicing/borrower-financials" },
    ],
  },
  {
    id: "insight-hazard",
    title: "Hazard loss timeline delays exceed policy threshold",
    confidence: 0.74,
    severity: "critical",
    category: "Compliance",
    windowDays: 7,
    drivers: [
      "Regulatory response window exceeded by 6 days",
      "Missing carrier letter for two claims",
    ],
    evidenceLinks: [
      { label: "Compliance inbox", href: "/governance/compliance" },
      { label: "Document review", href: "/governance/document-review" },
    ],
    actions: [
      { label: "Create task", href: "/governance/compliance" },
      { label: "Open in Servicing", href: "/servicing/management" },
    ],
  },
];

const riskDrivers: RiskDriver[] = [
  {
    id: "driver-hospitality",
    name: "Hospitality exposure",
    portfolioShare: 0.28,
    change: "+4.2%",
    trend: "up",
  },
  {
    id: "driver-construction",
    name: "Construction draws",
    portfolioShare: 0.21,
    change: "+2.1%",
    trend: "up",
  },
  {
    id: "driver-floating",
    name: "Floating rate loans",
    portfolioShare: 0.19,
    change: "-1.4%",
    trend: "down",
  },
  {
    id: "driver-secondary",
    name: "Secondary market liquidity",
    portfolioShare: 0.15,
    change: "Flat",
    trend: "flat",
  },
];

const trendMovers: TrendMover[] = [
  {
    id: "mover-dscr",
    label: "DSCR",
    metric: "-0.12",
    change: "Down",
    detail: "Largest drops in Midwest industrial assets",
  },
  {
    id: "mover-occupancy",
    label: "Occupancy",
    metric: "+1.8%",
    change: "Up",
    detail: "Sunbelt multifamily showing recovery",
  },
  {
    id: "mover-noi",
    label: "NOI",
    metric: "-3.5%",
    change: "Down",
    detail: "Retail CRE expenses spiking",
  },
];

const anomalies: Anomaly[] = [
  {
    id: "anomaly-expense",
    title: "Unusual expense spike",
    summary: "Property taxes jumped 18% vs prior quarter.",
    comparison: "Compared to Q2 average",
    reportLink: "/reports",
  },
  {
    id: "anomaly-vacancy",
    title: "Rent roll vacancy jump",
    summary: "Vacancy rate climbed to 14% in 10 days.",
    comparison: "Compared to trailing 60-day baseline",
    reportLink: "/reports",
  },
  {
    id: "anomaly-payment",
    title: "Payment irregularity",
    summary: "Two ACH reversals flagged for manual review.",
    comparison: "Compared to last 30 days",
    reportLink: "/servicing/payments",
  },
];

const recommendations: Recommendation[] = [
  {
    id: "rec-servicing-1",
    group: "Servicing",
    title: "Trigger proactive borrower outreach",
    description: "Notify servicing to schedule check-ins on the 3 watchlist loans.",
    actionLabel: "Open workflow",
    actionHref: "/servicing/management",
  },
  {
    id: "rec-servicing-2",
    group: "Servicing",
    title: "Update escrow replenishment plan",
    description: "Adjust reserve targets to cover Q4 insurance increases.",
    actionLabel: "Apply",
    actionHref: "/servicing/escrow",
  },
  {
    id: "rec-compliance-1",
    group: "Compliance",
    title: "Escalate hazard loss documentation",
    description: "Collect missing carrier letters and update compliance dossier.",
    actionLabel: "Open workflow",
    actionHref: "/governance/document-review",
  },
  {
    id: "rec-compliance-2",
    group: "Compliance",
    title: "Schedule regulatory scan for Q3 updates",
    description: "Run automated compliance checks before issuing borrower notices.",
    actionLabel: "Apply",
    actionHref: "/governance/compliance",
  },
  {
    id: "rec-markets-1",
    group: "Capital Markets",
    title: "Stage capital markets update",
    description: "Prepare a liquidity note for assets with DSCR compression.",
    actionLabel: "Open workflow",
    actionHref: "/markets/trades",
  },
  {
    id: "rec-markets-2",
    group: "Capital Markets",
    title: "Monitor secondary liquidity",
    description: "Track bid/ask spreads across the top 5 pools.",
    actionLabel: "Apply",
    actionHref: "/markets/exchange",
  },
];

export function useAiInsights() {
  return {
    insights,
    riskDrivers,
    trendMovers,
    anomalies,
    recommendations,
  };
}
