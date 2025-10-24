export interface Loan {
  id?: string | number;
  borrower_name?: string;
  amount?: number;
  interest_rate?: number;
  term_months?: number;
  start_date?: string;
  status?: string;
  [key: string]: any;
}

export interface Application {
  id?: string | number;
  name?: string;
  email?: string;
  amount?: number;
  credit_score?: number;
  kyc_passed?: boolean;
  submitted_at?: string;
  [key: string]: any;
}

export interface ApplicationOrchestration {
  id?: string | number;
  status?: string;
  applicant?: Record<string, any>;
  outputs?: {
    documentFields?: Record<string, any>;
    autoFill?: Record<string, any>;
    credit?: { score?: number; explanation?: string };
    fraud?: { suspicious?: boolean; anomalies?: string[] };
    scorecard?: {
      baseScore?: number;
      adjustedScore?: number;
      adjustment?: number;
      fundingReadiness?: number;
      delinquencyRisk?: number;
      forecast?: {
        expectedLossRate?: number;
        projectedLossExposure?: number | null;
        windowMonths?: number;
      };
      recommendations?: string[];
      narrative?: string;
    };
  };
  tasks?: Record<string, any>;
  document_url?: string | null;
  package_filename?: string | null;
  review_status?: string | null;
  submitted_at?: string;
  [key: string]: any;
}

export interface DrawRequest {
  id?: string | number;
  project?: string;
  amount?: number;
  status?: string;
  submitted_at?: string;
  submittedAt?: string;
  [key: string]: any;
}

export interface Escrow {
  loan_id?: string | number;
  tax_amount?: number;
  next_tax_due?: string;
  insurance_amount?: number;
  next_insurance_due?: string;
  projected_balance?: number;
  [key: string]: any;
}

export interface User {
  id?: string | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: any;
}

export interface PortfolioSummary {
  delinquency_pct?: number;
  spark?: number[];
  [key: string]: any;
}
