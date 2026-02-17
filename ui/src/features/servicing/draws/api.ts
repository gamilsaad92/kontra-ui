import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/servicing/draws', 'servicing-draws');

export const useDrawList = api.useEntityList;
export const useCreateDraw = api.useCreateEntity;
export const useDraw = api.useEntity;
export const useUpdateDraw = api.useUpdateEntity;
