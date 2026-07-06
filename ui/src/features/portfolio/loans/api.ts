import { createEntityApi } from '../../crud/createEntityApi';
import type { CanonicalEntity } from '../../crud/types';

const now = new Date().toISOString();

const SEED: CanonicalEntity[] = [
  { id: 'LN-2847', org_id: 'demo', status: 'active', title: 'Meridian Apartments', data: { borrower_name: 'Meridian Capital Partners LLC', property_type: 'Multifamily', property_address: '1420 Meridian Ave, Miami Beach, FL 33139', loan_amount: 98200000, interest_rate: 6.75, ltv: 66.1, origination_date: '2022-03-15', maturity_date: '2029-03-01', loan_purpose: 'acquisition', covenant_dscr_floor: 1.25, covenant_ltv_cap: 75, dscr: 1.48, occupancy: 94.2 }, created_at: '2022-03-15T00:00:00Z', updated_at: now },
  { id: 'LN-3201', org_id: 'demo', status: 'pending', title: 'Metro Industrial Portfolio', data: { borrower_name: 'Doral Industrial LLC', property_type: 'Industrial', property_address: '8800 NW 36th St, Doral, FL 33178', loan_amount: 44900000, interest_rate: 7.40, ltv: 72.1, origination_date: '2021-08-10', maturity_date: '2027-08-01', loan_purpose: 'refinance', covenant_dscr_floor: 1.20, covenant_ltv_cap: 75, dscr: 1.19, occupancy: 81.5 }, created_at: '2021-08-10T00:00:00Z', updated_at: now },
  { id: 'LN-4012', org_id: 'demo', status: 'active', title: 'Harbor Logistics Center', data: { borrower_name: 'Harborfront Logistics Inc.', property_type: 'Industrial', property_address: '22 Harborfront Way, Seattle, WA 98108', loan_amount: 23100000, interest_rate: 6.25, ltv: 59.6, origination_date: '2023-12-05', maturity_date: '2030-12-01', loan_purpose: 'acquisition', covenant_dscr_floor: 1.25, covenant_ltv_cap: 65, dscr: 1.71, occupancy: 100 }, created_at: '2023-12-05T00:00:00Z', updated_at: now },
  { id: 'LN-1899', org_id: 'demo', status: 'rejected', title: 'Lakewood Office Tower', data: { borrower_name: 'Lakewood CBD Holdings LLC', property_type: 'Office', property_address: '350 N Orleans St, Chicago, IL 60654', loan_amount: 74600000, interest_rate: 7.80, ltv: 83.6, origination_date: '2019-10-22', maturity_date: '2026-10-01', loan_purpose: 'refinance', covenant_dscr_floor: 1.25, covenant_ltv_cap: 75, dscr: 0.91, occupancy: 67.3 }, created_at: '2019-10-22T00:00:00Z', updated_at: now },
  { id: 'LN-5544', org_id: 'demo', status: 'active', title: 'Bayview Mixed-Use', data: { borrower_name: 'Bayview SF Partners LP', property_type: 'Mixed Use', property_address: '975 Third St, San Francisco, CA 94107', loan_amount: 127200000, interest_rate: 6.50, ltv: 60.0, origination_date: '2024-01-18', maturity_date: '2032-01-01', loan_purpose: 'acquisition', covenant_dscr_floor: 1.25, covenant_ltv_cap: 65, dscr: 1.62, occupancy: 97.8 }, created_at: '2024-01-18T00:00:00Z', updated_at: now },
  { id: 'LN-6671', org_id: 'demo', status: 'pending', title: 'Sunbelt Retail Centers', data: { borrower_name: 'Sunbelt Retail Fund III LLC', property_type: 'Retail', property_address: '1100 E Camelback Rd, Phoenix, AZ 85014', loan_amount: 38700000, interest_rate: 7.15, ltv: 71.5, origination_date: '2022-06-30', maturity_date: '2028-06-01', loan_purpose: 'bridge', covenant_dscr_floor: 1.20, covenant_ltv_cap: 75, dscr: 1.22, occupancy: 88.2 }, created_at: '2022-06-30T00:00:00Z', updated_at: now },
];

const api = createEntityApi('/portfolio/loans', 'portfolio-loans', SEED);

export const useLoanList = api.useEntityList;
export const useCreateLoan = api.useCreateEntity;
export const useLoan = api.useEntity;
export const useUpdateLoan = api.useUpdateEntity;
