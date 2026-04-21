import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/payments', 'servicing-payments');

export const usePaymentList = api.useEntityList;
export const useCreatePayment = api.useCreateEntity;
export const usePayment = api.useEntity;
export const useUpdatePayment = api.useUpdateEntity;
