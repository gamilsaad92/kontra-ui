import { useAiReviewsList } from '../../ai-reviews/api';
import type { AiReview } from '../../ai-reviews/types';
import type {
  InsightItem,
  InsightSeverity,
  InsightCategory,
  RiskDriver,
  TrendMover,
  Anomaly,
  Recommendation,
} from "../types";

function mapSeverity(r: AiReview): InsightSeverity {
  if (r.status === 'fail') return 'critical';
  if (r.status === 'needs_review') {
    const hasHigh = r.reasons?.some((reason) => reason.severity === 'high');
    return hasHigh ? 'high' : 'medium';
  }
  return 'low';
}

function mapCategory(type: string): InsightCategory {
  if (type === 'compliance') return 'Compliance';
  if (type === 'capital_markets') return 'Capital Markets';
  return 'Servicing';
}

function reviewToInsight(review: AiReview): InsightItem {
  return {
    id: review.id,
    title: review.title || review.summary || 'AI Review',
    confidence: review.confidence ?? 0.8,
    severity: mapSeverity(review),
    category: mapCategory(review.type),
    windowDays: 30,
    drivers: (review.reasons || []).map((r) => r.message),
    evidenceLinks: (review.evidence || []).map((e) => ({
      label: e.label,
      href: e.url,
    })),
    actions: (review.recommended_actions || []).map((a) => ({
      label: a.label,
      href: `/servicing/ai-validation/${review.id}`,
    })),
  };
}

const FALLBACK_INSIGHTS: InsightItem[] = [
  {
    id: 'fi-001',
    title: 'DSCR Below Covenant Threshold — Midtown Portfolio',
    confidence: 0.96,
    severity: 'critical',
    category: 'Servicing',
    windowDays: 30,
    drivers: [
      'NOI declined 11.2% YoY across 3 affected assets',
      'Debt service coverage ratio dropped to 1.04 (covenant: 1.20)',
      'Vacancy rate increased from 6% to 14% in past quarter',
    ],
    evidenceLinks: [
      { label: 'Rent Roll — Q4', href: '#' },
      { label: 'Operating Statement', href: '#' },
    ],
    actions: [{ label: 'Review Borrower Financials', href: '/servicing/borrower-financials' }],
  },
  {
    id: 'fi-002',
    title: 'Maturity Wall Exposure — $18.2M Maturing in 60 Days',
    confidence: 0.99,
    severity: 'critical',
    category: 'Capital Markets',
    windowDays: 30,
    drivers: [
      'Three loans totaling $18.2M mature within 60 days',
      'No extension agreements currently in place',
      'Current LTV exceeds refinance eligibility at two assets',
    ],
    evidenceLinks: [
      { label: 'Maturity Schedule', href: '#' },
    ],
    actions: [{ label: 'View Loan Pools', href: '/markets/pools' }],
  },
  {
    id: 'fi-003',
    title: 'NOI Compression Detected — Office Submarket',
    confidence: 0.91,
    severity: 'high',
    category: 'Servicing',
    windowDays: 30,
    drivers: [
      'Average NOI declined 8.3% across office assets',
      'Market rent growth flat vs. 4.1% underwriting assumption',
      'Tenant retention rate dropped to 71%',
    ],
    evidenceLinks: [
      { label: 'Market Comparison Report', href: '#' },
      { label: 'Lease Abstract', href: '#' },
    ],
    actions: [{ label: 'Servicing Overview', href: '/servicing/overview' }],
  },
  {
    id: 'fi-004',
    title: 'Insurance Coverage Gap — 2 Assets Unverified',
    confidence: 0.88,
    severity: 'high',
    category: 'Compliance',
    windowDays: 30,
    drivers: [
      'COI certificates expired or missing for 2 assets',
      'Policy renewal not confirmed 45+ days past deadline',
      'Lender-required coverage minimums may be unmet',
    ],
    evidenceLinks: [
      { label: 'Insurance Tracking Log', href: '#' },
    ],
    actions: [{ label: 'Compliance Center', href: '/compliance' }],
  },
  {
    id: 'fi-005',
    title: 'Tenant Concentration Risk — Single Tenant > 40% Revenue',
    confidence: 0.84,
    severity: 'medium',
    category: 'Servicing',
    windowDays: 30,
    drivers: [
      'Primary tenant accounts for 43% of gross revenue at 1 asset',
      'Tenant lease expires in 18 months with no renewal clause',
      'Replacement market rents 12% below current in-place rent',
    ],
    evidenceLinks: [
      { label: 'Lease Summary', href: '#' },
    ],
    actions: [{ label: 'View Asset', href: '/portfolio/assets' }],
  },
];

const FALLBACK_RISK_DRIVERS: RiskDriver[] = [
  { id: 'rd-1', name: 'Vacancy Rate Deterioration', portfolioShare: 0.34, change: '+6.2%', trend: 'up' },
  { id: 'rd-2', name: 'DSCR Compression', portfolioShare: 0.28, change: '+3.8%', trend: 'up' },
  { id: 'rd-3', name: 'Insurance Coverage Gaps', portfolioShare: 0.15, change: '+2.1%', trend: 'up' },
  { id: 'rd-4', name: 'Maturity Concentration', portfolioShare: 0.12, change: 'Stable', trend: 'flat' },
  { id: 'rd-5', name: 'Market Rent Softening', portfolioShare: 0.11, change: '-1.4%', trend: 'down' },
];

const FALLBACK_TREND_MOVERS: TrendMover[] = [
  { id: 'tm-1', label: 'Portfolio DSCR — Weighted Avg', metric: '1.21×', change: '▼ -0.08', detail: 'Dropped below 1.25× target threshold' },
  { id: 'tm-2', label: 'Occupancy Rate — Avg', metric: '87.4%', change: '▼ -2.1%', detail: 'Office assets driving decline; multifamily stable' },
  { id: 'tm-3', label: 'NOI — Portfolio Total', metric: '$4.2M', change: '▼ -5.3%', detail: 'Q4 NOI missed underwriting by 8.1% at 3 assets' },
];

const FALLBACK_ANOMALIES: Anomaly[] = [
  {
    id: 'an-1',
    title: 'Unusual Payment Velocity Detected',
    summary: 'Asset 0047 received 3 ACH transfers from different account holders within a 72-hour window — inconsistent with borrower payment history.',
    comparison: 'vs. 12-month baseline pattern',
    reportLink: '/servicing/payments',
  },
  {
    id: 'an-2',
    title: 'Document Timestamp Inconsistency',
    summary: 'Executed lease dates do not match county recording timestamps on 2 instruments. Model flagged a 14-day gap inconsistent with standard workflow.',
    comparison: 'vs. document workflow median',
    reportLink: '/compliance',
  },
  {
    id: 'an-3',
    title: 'NOI Variance Spike — 23% Deviation',
    summary: 'Reported NOI at Asset 0112 deviates 23.4% from predictive model output based on market comparables, occupancy, and lease terms.',
    comparison: 'vs. model prediction (±5% tolerance)',
    reportLink: '/servicing/overview',
  },
];

const FALLBACK_RECOMMENDATIONS: Recommendation[] = [
  { id: 'rc-1', group: 'Servicing', title: 'Request Updated Rent Roll for Midtown Portfolio', description: 'DSCR anomaly requires updated rent roll to verify current occupancy and collected rent figures.', actionLabel: 'Initiate Request', actionHref: '/servicing/overview' },
  { id: 'rc-2', group: 'Servicing', title: 'Initiate Maturity Extension Negotiation', description: 'Three loans approaching maturity. Begin lender-borrower extension discussion within 5 business days.', actionLabel: 'View Loans', actionHref: '/portfolio' },
  { id: 'rc-3', group: 'Compliance', title: 'Escalate Insurance Renewal to Borrower', description: 'Issue formal notice to borrower for 2 assets with expired COI. Curative period ends in 10 days.', actionLabel: 'Send Notice', actionHref: '/compliance' },
  { id: 'rc-4', group: 'Compliance', title: 'Record Document Discrepancy in Audit Log', description: 'Timestamp inconsistency on 2 lease instruments should be logged and reviewed by legal counsel.', actionLabel: 'Open Compliance', actionHref: '/compliance' },
  { id: 'rc-5', group: 'Capital Markets', title: 'Assess Payoff Eligibility for Maturing Loans', description: 'Evaluate refinance vs. payoff scenarios for the $18.2M maturity cluster based on current LTV.', actionLabel: 'Capital Markets', actionHref: '/markets/pools' },
  { id: 'rc-6', group: 'Capital Markets', title: 'Pool Eligible Assets for Tokenized Issuance', description: 'Three assets meet underwriting criteria for inclusion in a digital bond pool. Initiate due diligence.', actionLabel: 'View Tokenization', actionHref: '/tokenization' },
];

export function useAiInsights() {
  const all = useAiReviewsList({});
  const flagged = useAiReviewsList({ status: 'needs_review' });

  const apiWorking = !all.isError && !flagged.isError && !all.isLoading && !flagged.isLoading;
  const isLoading = all.isLoading || flagged.isLoading;

  const allItems = all.data?.items ?? [];
  const flaggedItems = flagged.data?.items ?? [];
  const hasLiveData = allItems.length > 0 || flaggedItems.length > 0;

  if (isLoading) {
    return {
      isLoading: true,
      isError: false,
      insights: [],
      riskDrivers: [],
      trendMovers: [],
      anomalies: [],
      recommendations: [],
      usingFallback: false,
    };
  }

  if (!apiWorking || !hasLiveData) {
    return {
      isLoading: false,
      isError: false,
      insights: FALLBACK_INSIGHTS,
      riskDrivers: FALLBACK_RISK_DRIVERS,
      trendMovers: FALLBACK_TREND_MOVERS,
      anomalies: FALLBACK_ANOMALIES,
      recommendations: FALLBACK_RECOMMENDATIONS,
      usingFallback: true,
    };
  }

  const insights: InsightItem[] = flaggedItems.map(reviewToInsight);

  const riskDrivers: RiskDriver[] = allItems
    .filter((r) => r.status !== 'pass')
    .slice(0, 5)
    .map((r, i) => ({
      id: r.id,
      name: r.entity_type || r.type,
      portfolioShare: Math.round((5 - i) * 8) / 100,
      change: r.status === 'fail' ? '+12%' : '+4%',
      trend: (r.status === 'fail' ? 'up' : 'flat') as 'up' | 'flat' | 'down',
    }));

  const trendMovers: TrendMover[] = allItems.slice(0, 3).map((r) => ({
    id: r.id,
    label: r.title || r.type,
    metric: `${Math.round((r.confidence ?? 0.8) * 100)}%`,
    change: r.status === 'fail' ? 'Flagged' : r.status === 'needs_review' ? 'Needs review' : 'Passed',
    detail: r.summary || '',
  }));

  const anomalies: Anomaly[] = allItems
    .filter((r) => r.status === 'fail')
    .slice(0, 3)
    .map((r) => ({
      id: r.id,
      title: r.title || 'Anomaly detected',
      summary: r.summary || '',
      comparison: 'vs. portfolio average',
      reportLink: `/servicing/ai-validation/${r.id}`,
    }));

  const recommendations: Recommendation[] = flaggedItems.slice(0, 6).map((r) => ({
    id: r.id,
    group: mapCategory(r.type),
    title: r.title || 'Review required',
    description: r.summary || '',
    actionLabel: 'View Review',
    actionHref: `/servicing/ai-validation/${r.id}`,
  }));

  return {
    isLoading: false,
    isError: false,
    insights,
    riskDrivers,
    trendMovers,
    anomalies,
    recommendations,
    usingFallback: false,
  };
}
