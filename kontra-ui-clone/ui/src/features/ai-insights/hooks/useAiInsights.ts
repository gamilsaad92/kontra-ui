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

export function useAiInsights() {
  const all = useAiReviewsList({});
  const flagged = useAiReviewsList({ status: 'needs_review' });

  const allItems = all.data?.items ?? [];
  const flaggedItems = flagged.data?.items ?? [];

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
    isLoading: all.isLoading || flagged.isLoading,
    isError: all.isError || flagged.isError,
    insights,
    riskDrivers,
    trendMovers,
    anomalies,
    recommendations,
  };
}
