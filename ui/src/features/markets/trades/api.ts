import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/markets/trades', 'markets-trades');

export const useTradeList = api.useEntityList;
export const useCreateTrade = api.useCreateEntity;
export const useTrade = api.useEntity;
export const useUpdateTrade = api.useUpdateEntity;
