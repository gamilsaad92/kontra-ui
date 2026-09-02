import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/portfolio/assets', 'portfolio-assets');

export const useAssetList = api.useEntityList;
export const useCreateAsset = api.useCreateEntity;
export const useAsset = api.useEntity;
export const useUpdateAsset = api.useUpdateEntity;
