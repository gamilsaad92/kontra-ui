import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'RPT-601', org_id: 'demo', status: 'approved', title: 'Q1 2026 Portfolio Performance Report', data: { report_type: 'Quarterly Portfolio Review', period: 'Q1 2026', loans_reviewed: 6, avg_dscr: 1.35, avg_ltv: 68.8, noi_collected: 7480000, delinquent_count: 1, total_balance: 406700000, prepared_by: 'Kontra Analytics', reviewed_by: 'Credit Committee' }, created_at: '2026-04-05T00:00:00Z', updated_at: now },
  { id: 'RPT-602', org_id: 'demo', status: 'approved', title: 'April 2026 Investor Distribution Report', data: { report_type: 'Monthly Investor Distribution', period: 'April 2026', distributions_paid: 264500, investors: 10290, tokens: 'KTRA-2847, KTRA-5544', yield_range: '7.2%–14.5%', processing_date: '2026-05-01', custodian: 'U.S. Bank N.A.', prepared_by: 'Kontra Servicing' }, created_at: '2026-05-01T00:00:00Z', updated_at: now },
  { id: 'RPT-603', org_id: 'demo', status: 'in-review', title: 'LN-1899 Special Servicing Watch Report', data: { report_type: 'Watch List / Special Servicing', loan: 'LN-1899', as_of: '2026-05-01', dscr: 0.91, ltv: 83.6, occupancy: '67.3%', days_overdue: 0, action_plan: 'Receiver appointment, 90-day workout, potential note sale', next_review: '2026-06-01', prepared_by: 'Special Servicing Team' }, created_at: '2026-05-01T00:00:00Z', updated_at: now },
  { id: 'RPT-604', org_id: 'demo', status: 'approved', title: 'Annual Reg D Investor Disclosure — 2025', data: { report_type: 'Annual Reg D Disclosure', year: 2025, tokens: 'KTRA-2847', total_investors: 1482, new_investors: 312, redemptions: 84, net_nav_change: '+2.3%', material_events: 'None', prepared_by: 'Legal & Compliance', filed_with: 'SEC EDGAR', filed_date: '2026-01-30' }, created_at: '2026-01-30T00:00:00Z', updated_at: now },
  { id: 'RPT-605', org_id: 'demo', status: 'draft', title: 'YC Demo Data Room Package — May 2026', data: { report_type: 'Investor Data Room', audience: 'YC Partners / Institutional Investors', contents: 'Portfolio summary, financial model, token economics, regulatory stack, team bios', prepared_by: 'Kontra Founding Team', confidential: true, version: 'v3.2', status_note: 'Final review before distribution.' }, created_at: '2026-05-01T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/reports/reports', 'reports-reports', SEED);

export const useReportList = api.useEntityList;
export const useCreateReport = api.useCreateEntity;
export const useReport = api.useEntity;
export const useUpdateReport = api.useUpdateEntity;
