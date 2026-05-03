import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'LEG-201', org_id: 'demo', status: 'approved', title: 'Loan Agreement — LN-2847 (Meridian)', data: { document_type: 'Promissory Note & Loan Agreement', loan: 'LN-2847', executed: '2022-03-15', governing_law: 'New York', counsel: 'Latham & Watkins LLP', parties: 'Meridian Capital Partners LLC / Kontra Loan Services', notes: 'First lien mortgage. SNDA executed. Title insurance $104M.' }, created_at: '2022-03-15T00:00:00Z', updated_at: now },
  { id: 'LEG-202', org_id: 'demo', status: 'approved', title: 'Subscription Agreement — KTRA-2847', data: { document_type: 'Securities Subscription Agreement', token: 'KTRA-2847', executed: '2026-01-15', governing_law: 'Delaware', counsel: 'Skadden Arps LLP', investor_reps: 'Accredited investor, investment purpose only', notes: 'ERC-1400 transfer restriction schedule attached as Exhibit B.' }, created_at: '2026-01-15T00:00:00Z', updated_at: now },
  { id: 'LEG-203', org_id: 'demo', status: 'in-review', title: 'Intercreditor Agreement — LN-1899 Workout', data: { document_type: 'Intercreditor & Standstill Agreement', loan: 'LN-1899', initiated: '2026-03-01', governing_law: 'Illinois', counsel: 'Kirkland & Ellis LLP', parties: 'Lakewood CBD Holdings LLC / Senior Lender / Mezz Lender', notes: '90-day standstill expiring 2026-06-01. Forbearance fee $125K paid.' }, created_at: '2026-03-01T00:00:00Z', updated_at: now },
  { id: 'LEG-204', org_id: 'demo', status: 'pending', title: 'Smart Contract Audit — Kontra ERC-1400', data: { document_type: 'Third-Party Security Audit', scope: 'ERC-1400 SecurityToken.sol, TransferRestrictions.sol', auditor: 'Trail of Bits', initiated: '2026-04-20', expected_completion: '2026-05-20', notes: 'Covers all 4 deployed token contracts. Findings remediation target: 2 weeks.' }, created_at: '2026-04-20T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/governance/legal-items', 'governance-legalItems', SEED);

export const useLegalItemList = api.useEntityList;
export const useCreateLegalItem = api.useCreateEntity;
export const useLegalItem = api.useEntity;
export const useUpdateLegalItem = api.useUpdateEntity;
