import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/escrows', 'servicing-escrows');

export const useEscrowList = api.useEntityList;
export const useCreateEscrow = api.useCreateEntity;
export const useEscrow = api.useEntity;
export const useUpdateEscrow = api.useUpdateEntity;
