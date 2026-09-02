import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'RSK-301', org_id: 'demo', status: 'active', title: 'Office Sector Concentration Risk', data: { risk_type: 'Concentration', severity: 'High', loan: 'LN-1899', exposure: 74600000, ltv: 83.6, dscr: 0.91, trigger: 'DSCR < 1.0x + occupancy < 70%', action: 'Special servicing referral, appraisal ordered', assigned_to: 'Risk Management Team', due_date: '2026-06-01' }, created_at: '2026-02-01T00:00:00Z', updated_at: now },
  { id: 'RSK-302', org_id: 'demo', status: 'active', title: 'Interest Rate Sensitivity — Floating Loans', data: { risk_type: 'Market / Rate', severity: 'Medium', affected_loans: 'LN-3201, LN-6671', floating_balance: 83600000, rate_index: 'SOFR', current_spread: '175-200bps', stress_scenario: '+200bps shock reduces avg DSCR by 0.18x', action: 'Rate cap analysis underway. Caps required at origination.', due_date: '2026-05-30' }, created_at: '2026-03-15T00:00:00Z', updated_at: now },
  { id: 'RSK-303', org_id: 'demo', status: 'pending', title: 'Token Transfer Restriction Gap', data: { risk_type: 'Operational / Compliance', severity: 'Low', token: 'KTRA-3201', issue: 'Reg S distribution compliance period tracking not automated', action: 'Engineering ticket filed. 40-day lockout manually enforced.', assigned_to: 'Platform Engineering', due_date: '2026-05-15' }, created_at: '2026-04-02T00:00:00Z', updated_at: now },
  { id: 'RSK-304', org_id: 'demo', status: 'approved', title: 'Maturity Wall — LN-1899 Oct 2026', data: { risk_type: 'Maturity / Refinance', severity: 'High', loan: 'LN-1899', maturity_date: '2026-10-01', balance: 74600000, refinance_probability: 'Low', action: 'Workout plan approved. REO contingency prepared. Broker engaged for property sale.', resolved_by: 'Credit Committee', resolved_date: '2026-03-22' }, created_at: '2026-01-10T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/governance/risk-items', 'governance-riskItems', SEED);

export const useRiskItemList = api.useEntityList;
export const useCreateRiskItem = api.useCreateEntity;
export const useRiskItem = api.useEntity;
export const useUpdateRiskItem = api.useUpdateEntity;
