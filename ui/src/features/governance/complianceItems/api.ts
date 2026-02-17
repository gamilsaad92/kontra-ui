import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/governance/compliance-items', 'governance-complianceItems');

export const useComplianceItemList = api.useEntityList;
export const useCreateComplianceItem = api.useCreateEntity;
export const useComplianceItem = api.useEntity;
export const useUpdateComplianceItem = api.useUpdateEntity;
