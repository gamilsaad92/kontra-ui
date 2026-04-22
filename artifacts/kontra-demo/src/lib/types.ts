export interface AnalysisProperty {
  name: string;
  address: string;
  type: string;
  loanId: string;
  loanBalance: number;
  loanType: string;
}

export interface AnalysisMetrics {
  occupancy: number;
  dscr: number;
  noi: number;
  debtService: number;
  ltv: number;
  noiVariance: number;
}

export interface AnalysisRisk {
  level: "HIGH" | "MEDIUM" | "LOW";
  category: string;
  description: string;
  trigger: string;
}

export interface AnalysisComplianceFlag {
  type: "WATCHLIST" | "VIOLATION" | "NOTICE";
  description: string;
  action: string;
  deadline: string;
}

export interface AnalysisWorkflowItem {
  id: string;
  label: string;
  status: "complete" | "in-progress" | "required" | "pending";
  responsible: string;
  dueDate: string;
  auditNote?: string;
}

export interface AnalysisWorkflow {
  type: string;
  title: string;
  items: AnalysisWorkflowItem[];
}

export interface AnalysisTokenization {
  poolValue: number;
  loanBalance: number;
  investorShares: number;
  shareValue: number;
  projectedCashFlow: number;
  yieldRate: number;
  riskRating: string;
  status: string;
}

export interface AnalysisResult {
  property: AnalysisProperty;
  metrics: AnalysisMetrics;
  aiSummary: string;
  risks: AnalysisRisk[];
  complianceFlags: AnalysisComplianceFlag[];
  issues: string[];
  recommendedActions: string[];
  workflow: AnalysisWorkflow;
  tokenization: AnalysisTokenization;
}

export interface AnalysisResponse {
  analysis: AnalysisResult;
}
