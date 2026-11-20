import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TasksPanel from './TasksPanel';

jest.mock('../../lib/apiBase', () => ({ API_BASE: '' }));

const task = {
  id: 'task-1',
  status: 'pending',
  owner_type: 'ai',
  owner_role: 'owner',
  title: 'Send an update',
  evidence: [],
  draft_action: { type: 'email', to: 'participant@example.test', subject: 'Update' },
};

describe('room-scoped task decisions', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ tasks: [task] }),
    }));
  });

  afterEach(() => jest.clearAllMocks());

  test.each([
    ['Approve & Send', 'approve'],
    ['Dismiss', 'dismiss'],
  ])('sends %s to the room-scoped route', async (buttonLabel, action) => {
    render(<TasksPanel propertyId="room-1" role="deal_coordinator" canManage />);
    fireEvent.click(await screen.findByRole('button', { name: buttonLabel }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/public/deal-room/room-1/tasks/task-1/${action}`,
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  test('does not show owner-only decision controls to participants', async () => {
    render(<TasksPanel propertyId="room-1" role="seller" />);
    await screen.findByText('Send an update');

    expect(screen.queryByRole('button', { name: 'Approve & Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
