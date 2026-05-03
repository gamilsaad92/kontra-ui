import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'POOL-001', org_id: 'demo', status: 'active', title: 'Miami Multifamily Pool A', data: { pool_balance: 312400000, loan_count: 14, avg_ltv: 64.2, avg_dscr: 1.44, property_type: 'Multifamily', geography: 'Southeast US', vintage: 2022, coupon: 6.85, structure: 'Pass-through', rating: 'AA', cusip: 'KNTR0012847', manager: 'Kontra Capital' }, created_at: '2023-01-10T00:00:00Z', updated_at: now },
  { id: 'POOL-002', org_id: 'demo', status: 'active', title: 'Industrial Logistics Pool I', data: { pool_balance: 187600000, loan_count: 9, avg_ltv: 61.8, avg_dscr: 1.58, property_type: 'Industrial', geography: 'National', vintage: 2023, coupon: 6.40, structure: 'Sequential pay', rating: 'AAA', cusip: 'KNTR0023201', manager: 'Kontra Capital' }, created_at: '2023-06-15T00:00:00Z', updated_at: now },
  { id: 'POOL-003', org_id: 'demo', status: 'active', title: 'Sunbelt Retail Securitization', data: { pool_balance: 94200000, loan_count: 6, avg_ltv: 70.3, avg_dscr: 1.26, property_type: 'Retail', geography: 'Sun Belt', vintage: 2022, coupon: 7.20, structure: 'Pro-rata', rating: 'A', cusip: 'KNTR0036671', manager: 'Kontra Capital' }, created_at: '2023-03-22T00:00:00Z', updated_at: now },
  { id: 'POOL-004', org_id: 'demo', status: 'pending', title: 'Office Workout Pool 2024', data: { pool_balance: 148000000, loan_count: 4, avg_ltv: 80.1, avg_dscr: 1.02, property_type: 'Office', geography: 'Gateway Markets', vintage: 2019, coupon: 7.90, structure: 'Controlled amort.', rating: 'BB', cusip: 'KNTR0041899', manager: 'Kontra Special Situations' }, created_at: '2024-02-01T00:00:00Z', updated_at: now },
  { id: 'POOL-005', org_id: 'demo', status: 'active', title: 'Mixed-Use West Coast Pool', data: { pool_balance: 241800000, loan_count: 8, avg_ltv: 62.4, avg_dscr: 1.55, property_type: 'Mixed-Use', geography: 'West Coast', vintage: 2024, coupon: 6.60, structure: 'Sequential pay', rating: 'AA', cusip: 'KNTR0055544', manager: 'Kontra Capital' }, created_at: '2024-03-01T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/markets/pools', 'markets-pools', SEED);

export const usePoolList = api.useEntityList;
export const useCreatePool = api.useCreateEntity;
export const usePool = api.useEntity;
export const useUpdatePool = api.useUpdateEntity;
