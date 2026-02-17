import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/governance/regulatory-scans', 'governance-regulatoryScans');

export const useRegulatoryScanList = api.useEntityList;
export const useCreateRegulatoryScan = api.useCreateEntity;
export const useRegulatoryScan = api.useEntity;
export const useUpdateRegulatoryScan = api.useUpdateEntity;
