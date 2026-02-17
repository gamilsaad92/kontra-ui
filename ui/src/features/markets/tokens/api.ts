import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/markets/tokens', 'markets-tokens');

export const useTokenList = api.useEntityList;
export const useCreateToken = api.useCreateEntity;
export const useToken = api.useEntity;
export const useUpdateToken = api.useUpdateEntity;
