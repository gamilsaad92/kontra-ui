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

  test('loads tasks from the room-scoped list endpoint and refreshes as the owner', async () => {
    render(<TasksPanel propertyId="room-1" role="deal_coordinator" canManage />);

    await screen.findByText('Send an update');

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deal-room/room-1/tasks',
        expect.objectContaining({ headers: {} }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/public/deal-room/room-1/tasks/refresh',
        expect.objectContaining({ method: 'POST', body: '{}' }),
      );
    });
  });

  test('renders the empty state when the room has no tasks', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ tasks: [] }),
    });

    render(<TasksPanel propertyId="room-1" role="seller" />);

    expect(await screen.findByText(/No outstanding items/)).toBeInTheDocument();
    expect(screen.getByText('Invite required participants')).toBeInTheDocument();
  });

  test('does not show owner-only decision controls to participants', async () => {
    render(<TasksPanel propertyId="room-1" role="seller" />);
    await screen.findByText('Send an update');

    expect(screen.queryByRole('button', { name: 'Approve & Send' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
