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
