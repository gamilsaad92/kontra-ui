import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/portfolio/loans', 'portfolio-loans');

export const useLoanList = api.useEntityList;
export const useCreateLoan = api.useCreateEntity;
export const useLoan = api.useEntity;
export const useUpdateLoan = api.useUpdateEntity;
