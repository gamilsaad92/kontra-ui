// ─── Workflow Pack definitions ────────────────────────────────────────────────
// Every piece of UI in the workspace derives from the selected pack.
// No CRE-specific assumptions exist outside the 'cre' pack entry.

export type ChecklistStatus = 'complete' | 'in_progress' | 'pending';
export type RiskLevel = 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  status: ChecklistStatus;
  assignedRole: string;
}

export interface PackRole {
  name: string;
  description: string;
  initials: string;
  avatarColor: string;
  invited: boolean;
}

export interface PackStage {
  id: string;
  label: string;
}

export interface PackMetric {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  positive: boolean; // is up good?
}

export interface PackRisk {
  level: RiskLevel;
  title: string;
  detail: string;
}

export interface PackInsights {
  score: number;
  grade: string;
  summary: string;
  metrics: PackMetric[];
  risks: PackRisk[];
}

export interface AuditEntry {
  actor: string;
  action: string;
  timestamp: string;
}

export interface WorkflowPack {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  badge: string;           // e.g. "CRE", "M&A", "VC"
  accentHex: string;
  accentTw: string;        // tailwind color class fragment, e.g. "amber"
  stages: PackStage[];
  currentStage: number;    // 0-indexed
  roles: PackRole[];
  checklist: ChecklistItem[];
  insights: PackInsights;
  sampleDealName: string;
  auditTrail: AuditEntry[];
}

// ─── CRE Pack ─────────────────────────────────────────────────────────────────
const crePack: WorkflowPack = {
  id: 'cre',
  name: 'Commercial Real Estate',
  shortName: 'CRE',
  tagline: 'Loan origination, compliance & asset management',
  description: 'For acquisitions, refinancings, and construction loans on commercial assets.',
  badge: 'CRE',
  accentHex: '#d97706',
  accentTw: 'amber',
  stages: [
    { id: 'loi', label: 'Letter of Intent' },
    { id: 'dd', label: 'Due Diligence' },
    { id: 'financing', label: 'Financing' },
    { id: 'closing', label: 'Closing' },
  ],
  currentStage: 1,
  roles: [
    { name: 'Borrower', description: 'Entity acquiring or refinancing the asset', initials: 'BR', avatarColor: '#7c3aed', invited: true },
    { name: 'Lender', description: 'Capital provider reviewing loan request', initials: 'LE', avatarColor: '#0891b2', invited: true },
    { name: 'Broker', description: 'Transaction intermediary', initials: 'BK', avatarColor: '#059669', invited: true },
    { name: 'Appraiser', description: 'Independent valuation specialist', initials: 'AP', avatarColor: '#d97706', invited: false },
    { name: 'Legal Counsel', description: 'Closing documentation & title', initials: 'LC', avatarColor: '#dc2626', invited: false },
  ],
  checklist: [
    { id: 't12', label: 'T12 Financial Statement', required: true, status: 'complete', assignedRole: 'Borrower' },
    { id: 'rentroll', label: 'Rent Roll', required: true, status: 'complete', assignedRole: 'Borrower' },
    { id: 'appraisal', label: 'Appraisal Report', required: true, status: 'in_progress', assignedRole: 'Appraiser' },
    { id: 'env', label: 'Phase I Environmental', required: true, status: 'pending', assignedRole: 'Borrower' },
    { id: 'insurance', label: 'Property Insurance Binder', required: true, status: 'pending', assignedRole: 'Borrower' },
    { id: 'survey', label: 'ALTA Survey', required: false, status: 'pending', assignedRole: 'Borrower' },
    { id: 'loan', label: 'Loan Agreement Draft', required: true, status: 'pending', assignedRole: 'Legal Counsel' },
  ],
  insights: {
    score: 74,
    grade: 'B+',
    summary: 'Strong occupancy at 94.2% with stable NOI. DSCR of 1.32x exceeds minimum threshold. Phase I Environmental pending — proceed with financing once filed.',
    metrics: [
      { label: 'Occupancy', value: '94.2%', trend: 'up', positive: true },
      { label: 'DSCR', value: '1.32x', trend: 'up', positive: true },
      { label: 'LTV', value: '62.8%', trend: 'down', positive: true },
      { label: 'NOI Variance', value: '-3.1%', trend: 'down', positive: false },
    ],
    risks: [
      { level: 'medium', title: 'DSCR approaching 1.25x covenant', detail: 'Current at 1.32x — 5.5% margin from threshold' },
      { level: 'low', title: 'Tenant concentration', detail: '2 anchor tenants represent 38% of NRA' },
    ],
  },
  sampleDealName: '850 Park Avenue — Bridge Acquisition',
  auditTrail: [
    { actor: 'System', action: 'Workspace created with CRE Workflow Pack', timestamp: '2 hours ago' },
    { actor: 'Borrower', action: 'Uploaded T12 Financial Statement', timestamp: '1 hour 45 min ago' },
    { actor: 'AI Engine', action: 'Extracted 47 financial data points from T12', timestamp: '1 hour 44 min ago' },
    { actor: 'Borrower', action: 'Uploaded Rent Roll (32 units)', timestamp: '1 hour 30 min ago' },
    { actor: 'Lender', action: 'Reviewed financials — flagged DSCR margin', timestamp: '1 hour ago' },
    { actor: 'Broker', action: 'Confirmed appraisal order placed', timestamp: '45 min ago' },
  ],
};

// ─── Business Acquisition Pack ────────────────────────────────────────────────
const acquisitionPack: WorkflowPack = {
  id: 'acquisition',
  name: 'Business Acquisition',
  shortName: 'M&A',
  tagline: 'M&A transactions from NDA through close',
  description: 'For acquiring private companies, asset purchases, and management buyouts.',
  badge: 'M&A',
  accentHex: '#2563eb',
  accentTw: 'blue',
  stages: [
    { id: 'nda', label: 'NDA & Exclusivity' },
    { id: 'valuation', label: 'Valuation & IOI' },
    { id: 'dd', label: 'Due Diligence' },
    { id: 'loi', label: 'LOI & Negotiation' },
    { id: 'closing', label: 'Closing' },
  ],
  currentStage: 2,
  roles: [
    { name: 'Buyer', description: 'Acquiring entity conducting purchase', initials: 'BY', avatarColor: '#2563eb', invited: true },
    { name: 'Seller', description: 'Business owner / management team', initials: 'SL', avatarColor: '#7c3aed', invited: true },
    { name: 'M&A Advisor', description: 'Transaction intermediary & process lead', initials: 'MA', avatarColor: '#059669', invited: true },
    { name: 'QoE Accountant', description: 'Financial due diligence & QoE report', initials: 'QE', avatarColor: '#d97706', invited: true },
    { name: 'Legal Counsel', description: 'Purchase agreement & deal structure', initials: 'LC', avatarColor: '#dc2626', invited: false },
  ],
  checklist: [
    { id: 'cim', label: 'Confidential Information Memorandum', required: true, status: 'complete', assignedRole: 'M&A Advisor' },
    { id: 'financials', label: '3-Year Audited Financials', required: true, status: 'complete', assignedRole: 'Seller' },
    { id: 'tax', label: 'Tax Returns (3 Years)', required: true, status: 'complete', assignedRole: 'Seller' },
    { id: 'qoe', label: 'Quality of Earnings Report', required: true, status: 'in_progress', assignedRole: 'QoE Accountant' },
    { id: 'loi', label: 'Letter of Intent (Signed)', required: true, status: 'in_progress', assignedRole: 'Buyer' },
    { id: 'contracts', label: 'Key Customer Contracts', required: true, status: 'pending', assignedRole: 'Seller' },
    { id: 'ip', label: 'IP & Patent Schedule', required: false, status: 'pending', assignedRole: 'Seller' },
    { id: 'spa', label: 'Stock Purchase Agreement', required: true, status: 'pending', assignedRole: 'Legal Counsel' },
  ],
  insights: {
    score: 81,
    grade: 'A-',
    summary: 'Revenue growth of 28% YoY with healthy EBITDA margins of 22%. QoE in progress — preliminary findings show normalized EBITDA of $4.2M. Customer concentration is the primary watch item.',
    metrics: [
      { label: 'Revenue Growth', value: '+28% YoY', trend: 'up', positive: true },
      { label: 'EBITDA Margin', value: '22%', trend: 'up', positive: true },
      { label: 'NRR', value: '118%', trend: 'up', positive: true },
      { label: 'Churn', value: '4.2%', trend: 'up', positive: false },
    ],
    risks: [
      { level: 'medium', title: 'Customer concentration', detail: 'Top 3 customers represent 52% of revenue' },
      { level: 'low', title: 'Key person dependency', detail: 'Founder drives 3 of top 5 customer relationships' },
    ],
  },
  sampleDealName: 'Meridian SaaS — Strategic Acquisition',
  auditTrail: [
    { actor: 'System', action: 'Workspace created with Business Acquisition Workflow Pack', timestamp: '3 hours ago' },
    { actor: 'M&A Advisor', action: 'Uploaded Confidential Information Memorandum', timestamp: '2 hours 50 min ago' },
    { actor: 'AI Engine', action: 'Identified 12 financial risk signals in CIM', timestamp: '2 hours 49 min ago' },
    { actor: 'Seller', action: 'Uploaded 3-year audited financials', timestamp: '2 hours ago' },
    { actor: 'QoE Accountant', action: 'Started Quality of Earnings analysis', timestamp: '1 hour 20 min ago' },
    { actor: 'Buyer', action: 'Signed NDA — exclusivity period begins', timestamp: '30 min ago' },
  ],
};

// ─── Fundraising Pack ─────────────────────────────────────────────────────────
const fundraisingPack: WorkflowPack = {
  id: 'fundraising',
  name: 'Capital Raise',
  shortName: 'Capital',
  tagline: 'Equity rounds, venture capital & structured capital',
  description: 'For Series A–D rounds, growth equity, and structured credit transactions.',
  badge: 'VC',
  accentHex: '#7c3aed',
  accentTw: 'violet',
  stages: [
    { id: 'termsheet', label: 'Term Sheet' },
    { id: 'diligence', label: 'Investor Diligence' },
    { id: 'docs', label: 'Documentation' },
    { id: 'close', label: 'Final Close' },
  ],
  currentStage: 1,
  roles: [
    { name: 'Company / Issuer', description: 'Entity raising capital', initials: 'CO', avatarColor: '#7c3aed', invited: true },
    { name: 'Lead Investor', description: 'Anchor investor setting terms', initials: 'LI', avatarColor: '#2563eb', invited: true },
    { name: 'Co-Investor', description: 'Participating alongside lead', initials: 'CI', avatarColor: '#059669', invited: true },
    { name: 'Legal Counsel', description: 'Subscription docs & regulatory compliance', initials: 'LC', avatarColor: '#dc2626', invited: false },
    { name: 'Financial Advisor', description: 'Placement agent or investment banker', initials: 'FA', avatarColor: '#d97706', invited: false },
  ],
  checklist: [
    { id: 'deck', label: 'Investor Pitch Deck', required: true, status: 'complete', assignedRole: 'Company / Issuer' },
    { id: 'model', label: 'Financial Model & 5-Year Projections', required: true, status: 'complete', assignedRole: 'Company / Issuer' },
    { id: 'captable', label: 'Cap Table (Pre & Post-Money)', required: true, status: 'complete', assignedRole: 'Company / Issuer' },
    { id: 'termsheet', label: 'Signed Term Sheet', required: true, status: 'in_progress', assignedRole: 'Lead Investor' },
    { id: 'ddq', label: 'Due Diligence Questionnaire', required: true, status: 'in_progress', assignedRole: 'Company / Issuer' },
    { id: 'subscription', label: 'Subscription Agreement', required: true, status: 'pending', assignedRole: 'Legal Counsel' },
    { id: 'sideletter', label: 'Side Letter (Lead Investor)', required: false, status: 'pending', assignedRole: 'Legal Counsel' },
    { id: 'legal', label: 'Legal Opinion', required: true, status: 'pending', assignedRole: 'Legal Counsel' },
  ],
  insights: {
    score: 88,
    grade: 'A',
    summary: 'Compelling unit economics with 3.2x LTV:CAC ratio and 94% gross margins. ARR of $8.4M growing 140% NRR. Term sheet review in progress at $42M post-money.',
    metrics: [
      { label: 'ARR', value: '$8.4M', trend: 'up', positive: true },
      { label: 'Gross Margin', value: '94%', trend: 'up', positive: true },
      { label: 'NRR', value: '140%', trend: 'up', positive: true },
      { label: 'CAC Payback', value: '8 mo', trend: 'down', positive: true },
    ],
    risks: [
      { level: 'low', title: 'Regulatory filing', detail: 'Reg D filing required within 15 days of first close' },
      { level: 'low', title: 'Valuation sensitivity', detail: 'Post-money $42M — 12x ARR multiple vs. 11x peer median' },
    ],
  },
  sampleDealName: 'Nexus AI — Series B Capital Raise',
  auditTrail: [
    { actor: 'System', action: 'Workspace created with Capital Raise Workflow Pack', timestamp: '1 hour ago' },
    { actor: 'Company / Issuer', action: 'Uploaded Investor Pitch Deck (42 slides)', timestamp: '58 min ago' },
    { actor: 'AI Engine', action: 'Benchmarked financials against 240 comparable rounds', timestamp: '57 min ago' },
    { actor: 'Company / Issuer', action: 'Uploaded Financial Model & Cap Table', timestamp: '45 min ago' },
    { actor: 'Lead Investor', action: 'Reviewed materials — initiated term sheet', timestamp: '20 min ago' },
    { actor: 'AI Engine', action: 'Deal score updated to 88 / A', timestamp: '19 min ago' },
  ],
};

export const PACKS: Record<string, WorkflowPack> = {
  cre: crePack,
  acquisition: acquisitionPack,
  fundraising: fundraisingPack,
};

export const PACK_LIST = Object.values(PACKS);
