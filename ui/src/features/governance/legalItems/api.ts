import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/governance/legal-items', 'governance-legalItems');

export const useLegalItemList = api.useEntityList;
export const useCreateLegalItem = api.useCreateEntity;
export const useLegalItem = api.useEntity;
export const useUpdateLegalItem = api.useUpdateEntity;
