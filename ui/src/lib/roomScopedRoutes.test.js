import {
  roomScopedAiReviewPath,
  roomScopedTaskActionPath,
} from './roomScopedRoutes.mjs';

describe('room-scoped browser routes', () => {
  const cookiePath = '/api/public/deal-room/room%2Fone';

  test.each([
    ['/api/ai/analyze-document', `${cookiePath}/ai/analyze-document`],
    ['/api/ai/analyze-inspection', `${cookiePath}/ai/analyze-inspection`],
  ])('places AI document review under the owner cookie path', (endpoint, expected) => {
    expect(roomScopedAiReviewPath('room/one', endpoint)).toBe(expected);
  });

  test.each(['approve', 'dismiss'])('places task %s under the owner cookie path', action => {
    expect(roomScopedTaskActionPath('room/one', 'task-1', action))
      .toBe(`${cookiePath}/tasks/task-1/${action}`);
  });

  test('preserves non-document AI routes and rejects unsupported task actions', () => {
    expect(roomScopedAiReviewPath('room-1', '/api/ai/score-property')).toBe('/api/ai/score-property');
    expect(() => roomScopedTaskActionPath('room-1', 'task-1', 'delete')).toThrow('Unsupported task action');
  });
});
