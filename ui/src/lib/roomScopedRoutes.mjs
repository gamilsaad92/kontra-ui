const AI_REVIEW_PREFIX = '/api/ai/';
const ROOM_SCOPED_AI_ACTIONS = new Set([
  'analyze-document',
  'analyze-inspection',
  'review-insurance',
  'review-financials',
  'review-legal',
  'review-brand-standards',
]);

export function roomScopedAiReviewPath(propertyId, endpoint) {
  const path = String(endpoint || '/api/ai/analyze-document');
  if (!path.startsWith(AI_REVIEW_PREFIX)) return path;
  const action = path.slice(AI_REVIEW_PREFIX.length);
  if (!ROOM_SCOPED_AI_ACTIONS.has(action)) return path;
  return `/api/public/deal-room/${encodeURIComponent(propertyId)}/ai/${action}`;
}

export function roomScopedTaskActionPath(propertyId, taskId, action) {
  if (!['approve', 'dismiss'].includes(action)) {
    throw new Error('Unsupported task action');
  }
  return `/api/public/deal-room/${encodeURIComponent(propertyId)}/tasks/${encodeURIComponent(taskId)}/${action}`;
}
