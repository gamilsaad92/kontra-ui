import { createEntityApi } from '../../crud/createEntityApi';

const api = createEntityApi('/governance/document-reviews', 'governance-documentReviews');

export const useDocumentReviewList = api.useEntityList;
export const useCreateDocumentReview = api.useCreateEntity;
export const useDocumentReview = api.useEntity;
export const useUpdateDocumentReview = api.useUpdateEntity;
