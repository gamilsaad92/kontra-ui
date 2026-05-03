import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'REG-401', org_id: 'demo', status: 'approved', title: 'Form D Filing — KTRA-2847 (Q1 2026)', data: { filing_type: 'Form D (Reg D 506(c))', token: 'KTRA-2847', filed_with: 'U.S. Securities and Exchange Commission', filed_date: '2026-01-12', total_offering: 148500000, amount_sold: 98200000, investors: 1482, status_note: 'Accepted. No deficiencies. Annual amendment due Jan 12, 2027.' }, created_at: '2026-01-12T00:00:00Z', updated_at: now },
  { id: 'REG-402', org_id: 'demo', status: 'approved', title: 'CFPB Servicing Audit — Q4 2025', data: { scan_type: 'CFPB Servicing Compliance', period: 'Q4 2025', scope: 'Loan modification, payment processing, escrow management', findings: 0, recommendations: 2, auditor: 'CFPB Examiner Team 4', result: 'Satisfactory. Two process improvement recommendations accepted.', completed: '2026-01-30' }, created_at: '2026-01-30T00:00:00Z', updated_at: now },
  { id: 'REG-403', org_id: 'demo', status: 'pending', title: 'SEC No-Action Request — Tokenized Mortgages', data: { filing_type: 'SEC No-Action Letter Request', topic: 'Treatment of ERC-1400 mortgage-backed tokens as securities', filed_with: 'SEC Division of Corporation Finance', filed_date: '2026-03-15', expected_response: '2026-09-15', counsel: 'Sullivan & Cromwell LLP', status_note: 'Formal acknowledgement received. Review period: 6 months.' }, created_at: '2026-03-15T00:00:00Z', updated_at: now },
  { id: 'REG-404', org_id: 'demo', status: 'in-review', title: 'FinCEN AML Program Review — 2026', data: { scan_type: 'AML Program Self-Assessment', period: '2026 Annual', scope: 'KYC onboarding, transaction monitoring, SAR filing', sars_filed: 3, ctr_filings: 0, training_completion: '98%', reviewer: 'Internal Compliance + Deloitte Advisory', due_date: '2026-06-30' }, created_at: '2026-04-01T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/governance/regulatory-scans', 'governance-regulatoryScans', SEED);

export const useRegulatoryScanList = api.useEntityList;
export const useCreateRegulatoryScan = api.useCreateEntity;
export const useRegulatoryScan = api.useEntity;
export const useUpdateRegulatoryScan = api.useUpdateEntity;
