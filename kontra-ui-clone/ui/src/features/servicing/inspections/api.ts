import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/inspections', 'servicing-inspections');

export const useInspectionList = api.useEntityList;
export const useCreateInspection = api.useCreateEntity;
export const useInspection = api.useEntity;
export const useUpdateInspection = api.useUpdateEntity;
