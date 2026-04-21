import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/management', 'servicing-management');

export const useManagementItemList = api.useEntityList;
export const useCreateManagementItem = api.useCreateEntity;
export const useManagementItem = api.useEntity;
export const useUpdateManagementItem = api.useUpdateEntity;
