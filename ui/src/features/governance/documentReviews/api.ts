import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'DOC-501', org_id: 'demo', status: 'approved', title: 'Title Insurance Policy — LN-2847', data: { document_type: 'ALTA Lender Title Insurance', loan: 'LN-2847', insurer: 'First American Title Insurance', policy_amount: 104000000, issued: '2022-03-14', endorsements: 'ALTA 9, ALTA 28, ALTA 35', status_note: 'Clean title. No exceptions. Policy in custodian vault.' }, created_at: '2022-03-14T00:00:00Z', updated_at: now },
  { id: 'DOC-502', org_id: 'demo', status: 'approved', title: 'MAI Appraisal — LN-5544 (2026 Update)', data: { document_type: 'MAI Appraisal Report', loan: 'LN-5544', appraiser: 'HFF | JLL Valuation', appraised_value: 212000000, effective_date: '2026-03-22', approach: 'Income + Sales Comparison', cap_rate_applied: 5.71, status_note: 'Supports current LTV of 60.0%. No value impairment.' }, created_at: '2026-03-22T00:00:00Z', updated_at: now },
  { id: 'DOC-503', org_id: 'demo', status: 'in-review', title: 'Environmental Phase I — LN-4012 (Renewal)', data: { document_type: 'Phase I Environmental Site Assessment', loan: 'LN-4012', firm: 'AECOM Environmental Services', site: '22 Harborfront Way, Seattle WA', initiated: '2026-04-10', expected: '2026-05-10', status_note: 'Previous Phase I (2023) showed no RECs. Renewal for lender annual requirement.' }, created_at: '2026-04-10T00:00:00Z', updated_at: now },
  { id: 'DOC-504', org_id: 'demo', status: 'pending', title: 'Whitepaper — Kontra Tokenized Mortgage Platform', data: { document_type: 'Technical & Legal Whitepaper', scope: 'ERC-1400 architecture, Reg D/S compliance engine, waterfall mechanics', authors: 'Kontra Platform Team + Sullivan & Cromwell LLP', version: '2.1', drafted: '2026-04-01', legal_review_by: '2026-05-15', status_note: 'Final legal sign-off pending. Distribution to institutional investors upon approval.' }, created_at: '2026-04-01T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/governance/document-reviews', 'governance-documentReviews', SEED);

export const useDocumentReviewList = api.useEntityList;
export const useCreateDocumentReview = api.useCreateEntity;
export const useDocumentReview = api.useEntity;
export const useUpdateDocumentReview = api.useUpdateEntity;
