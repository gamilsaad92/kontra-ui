import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/markets/exchange-listings', 'markets-exchangeListings');

export const useExchangeListingList = api.useEntityList;
export const useCreateExchangeListing = api.useCreateEntity;
export const useExchangeListing = api.useEntity;
export const useUpdateExchangeListing = api.useUpdateEntity;
