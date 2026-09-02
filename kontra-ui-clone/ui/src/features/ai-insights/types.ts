export type InsightSeverity = "low" | "medium" | "high" | "critical";
export type InsightCategory = "Servicing" | "Compliance" | "Capital Markets";

export type InsightEvidenceLink = {
  label: string;
  href: string;
};

export type InsightAction = {
  label: string;
  href: string;
};

export type InsightItem = {
  id: string;
  title: string;
  confidence: number;
  severity: InsightSeverity;
  category: InsightCategory;
  windowDays: number;
  drivers: string[];
  evidenceLinks: InsightEvidenceLink[];
  actions: InsightAction[];
};

export type RiskDriver = {
  id: string;
  name: string;
  portfolioShare: number;
  change: string;
  trend: "up" | "down" | "flat";
};

export type TrendMover = {
  id: string;
  label: string;
  metric: string;
  change: string;
  detail: string;
};

export type Anomaly = {
  id: string;
  title: string;
  summary: string;
  comparison: string;
  reportLink: string;
};

export type Recommendation = {
  id: string;
  group: InsightCategory;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};
