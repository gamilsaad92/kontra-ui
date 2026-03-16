import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/reports/reports', 'reports-reports');

export const useReportList = api.useEntityList;
export const useCreateReport = api.useCreateEntity;
export const useReport = api.useEntity;
export const useUpdateReport = api.useUpdateEntity;
