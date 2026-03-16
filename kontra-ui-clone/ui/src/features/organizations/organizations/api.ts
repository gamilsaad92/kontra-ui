import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/orgs', 'organizations-organizations');

export const useOrganizationList = api.useEntityList;
export const useCreateOrganization = api.useCreateEntity;
export const useOrganization = api.useEntity;
export const useUpdateOrganization = api.useUpdateEntity;
