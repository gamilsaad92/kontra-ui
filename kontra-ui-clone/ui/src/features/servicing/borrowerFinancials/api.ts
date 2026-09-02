import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/borrower-financials', 'servicing-borrowerFinancials');

export const useBorrowerFinancialList = api.useEntityList;
export const useCreateBorrowerFinancial = api.useCreateEntity;
export const useBorrowerFinancial = api.useEntity;
export const useUpdateBorrowerFinancial = api.useUpdateEntity;
