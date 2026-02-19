export const selectColumns = {
  organizations: ['id', 'name', 'created_at'],
  payments: ['id', 'loan_id', 'amount', 'currency', 'status', 'data', 'created_at'],
  tokens: ['id', 'pool_id', 'symbol', 'supply', 'status', 'data', 'created_at'],
  loans: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  assets: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  inspections: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  draws: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  escrows: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  borrower_financials: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  management_items: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  compliance_items: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  legal_items: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  regulatory_scans: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  risk_items: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  document_reviews: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  reports: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  pools: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  trades: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  exchange_listings: ['id', 'org_id', 'title', 'status', 'data', 'created_at'],
  pool_loans: ['id', 'org_id', 'pool_id', 'loan_id', 'created_at'],
  org_memberships: ['id', 'org_id', 'user_id', 'role', 'created_at'],
  ai_reviews: ['id', 'org_id', 'type', 'entity_type', 'entity_id', 'status', 'confidence', 'title', 'summary', 'reasons', 'evidence', 'recommended_actions', 'proposed_updates', 'created_by', 'created_at', 'updated_at'],
  ai_review_actions: ['id', 'org_id', 'review_id', 'action_type', 'action_payload', 'outcome', 'notes', 'actor_id', 'created_at'],
} as const;

export function selectFor(table: keyof typeof selectColumns): string {
  return selectColumns[table].join(', ');
}
