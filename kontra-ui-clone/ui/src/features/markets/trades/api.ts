import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'TRD-4401', org_id: 'demo', status: 'settled', title: 'KTRA-2847 Block — 250 units', data: { token: 'KTRA-2847', buyer: 'Blackrock Alts Fund XII', seller: 'Meridian Capital Partners LLC', units: 250, price_per_unit: 102.73, total: 25682500, trade_date: '2026-04-15', settlement_date: '2026-04-17', pool: 'POOL-001', nav_at_trade: 102.41 }, created_at: '2026-04-15T00:00:00Z', updated_at: now },
  { id: 'TRD-4389', org_id: 'demo', status: 'settled', title: 'KTRA-5544 Block — 180 units', data: { token: 'KTRA-5544', buyer: 'Apollo Real Assets LP', seller: 'Bayview SF Partners LP', units: 180, price_per_unit: 98.50, total: 17730000, trade_date: '2026-04-10', settlement_date: '2026-04-12', pool: 'POOL-005', nav_at_trade: 98.22 }, created_at: '2026-04-10T00:00:00Z', updated_at: now },
  { id: 'TRD-4372', org_id: 'demo', status: 'settled', title: 'KTRA-2847 Secondary — 90 units', data: { token: 'KTRA-2847', buyer: 'Ares Debt Fund V', seller: 'Secondary Market Desk', units: 90, price_per_unit: 101.80, total: 9162000, trade_date: '2026-03-28', settlement_date: '2026-03-30', pool: 'POOL-001', nav_at_trade: 101.55 }, created_at: '2026-03-28T00:00:00Z', updated_at: now },
  { id: 'TRD-4358', org_id: 'demo', status: 'pending', title: 'KTRA-3201 Block — 320 units', data: { token: 'KTRA-3201', buyer: 'KKR Real Estate Finance', seller: 'Doral Industrial LLC', units: 320, price_per_unit: 95.20, total: 30464000, trade_date: '2026-05-01', settlement_date: '2026-05-05', pool: 'POOL-003', nav_at_trade: 95.40 }, created_at: '2026-05-01T00:00:00Z', updated_at: now },
  { id: 'TRD-4341', org_id: 'demo', status: 'settled', title: 'KTRA-5544 Block — 420 units', data: { token: 'KTRA-5544', buyer: 'Nuveen Real Assets', seller: 'Institutional Desk', units: 420, price_per_unit: 97.90, total: 41118000, trade_date: '2026-03-10', settlement_date: '2026-03-12', pool: 'POOL-005', nav_at_trade: 97.64 }, created_at: '2026-03-10T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/markets/trades', 'markets-trades', SEED);

export const useTradeList = api.useEntityList;
export const useCreateTrade = api.useCreateEntity;
export const useTrade = api.useEntity;
export const useUpdateTrade = api.useUpdateEntity;
