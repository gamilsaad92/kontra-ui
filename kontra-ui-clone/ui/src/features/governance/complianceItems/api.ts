import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'COMP-101', org_id: 'demo', status: 'approved', title: 'Reg D 506(c) — KTRA-2847 Offering', data: { exemption: 'Reg D 506(c)', loan: 'LN-2847', filing_date: '2026-01-12', expiry: '2026-12-31', accredited_only: true, max_investors: 2000, current_investors: 1482, attorney: 'Latham & Watkins LLP', notes: 'Form D filed with SEC on 2026-01-12. All investors verified accredited.' }, created_at: '2026-01-12T00:00:00Z', updated_at: now },
  { id: 'COMP-102', org_id: 'demo', status: 'approved', title: 'Reg D 506(c) — KTRA-5544 Offering', data: { exemption: 'Reg D 506(c)', loan: 'LN-5544', filing_date: '2026-02-01', expiry: '2027-01-31', accredited_only: true, max_investors: 2000, current_investors: 876, attorney: 'Skadden Arps LLP', notes: 'Blue sky filings complete in CA, NY, TX, FL.' }, created_at: '2026-02-01T00:00:00Z', updated_at: now },
  { id: 'COMP-103', org_id: 'demo', status: 'pending', title: 'Reg S — KTRA-3201 EU Tranche', data: { exemption: 'Reg S', loan: 'LN-3201', filing_date: '2026-04-10', expiry: '2027-04-09', us_persons: false, distribution_compliance_period: 40, attorney: 'Sullivan & Cromwell LLP', notes: 'Offshore distribution to EU qualified investors. Distribution compliance period running.' }, created_at: '2026-04-10T00:00:00Z', updated_at: now },
  { id: 'COMP-104', org_id: 'demo', status: 'in-review', title: 'AML / KYC — Q1 2026 Batch Review', data: { review_type: 'AML/KYC', period: 'Q1 2026', investor_count: 412, cleared: 398, flagged: 14, high_risk: 2, analyst: 'Kontra Compliance Team', deadline: '2026-05-15', notes: '14 investors flagged for enhanced due diligence. 2 accounts temporarily suspended.' }, created_at: '2026-04-01T00:00:00Z', updated_at: now },
  { id: 'COMP-105', org_id: 'demo', status: 'approved', title: 'DSCR Covenant Certification — LN-2847 Q1', data: { covenant_type: 'DSCR floor', loan: 'LN-2847', period: 'Q1 2026', reported_dscr: 1.48, floor: 1.25, result: 'Pass', certified_by: 'CBRE Property Management', certified_date: '2026-04-05' }, created_at: '2026-04-05T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/governance/compliance-items', 'governance-complianceItems', SEED);

export const useComplianceItemList = api.useEntityList;
export const useCreateComplianceItem = api.useCreateEntity;
export const useComplianceItem = api.useEntity;
export const useUpdateComplianceItem = api.useUpdateEntity;
