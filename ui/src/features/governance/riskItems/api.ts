import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/governance/risk-items', 'governance-riskItems');

export const useRiskItemList = api.useEntityList;
export const useCreateRiskItem = api.useCreateEntity;
export const useRiskItem = api.useEntity;
export const useUpdateRiskItem = api.useUpdateEntity;
