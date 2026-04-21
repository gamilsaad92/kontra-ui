import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/markets/pools', 'markets-pools');

export const usePoolList = api.useEntityList;
export const useCreatePool = api.useCreateEntity;
export const usePool = api.useEntity;
export const useUpdatePool = api.useUpdateEntity;
