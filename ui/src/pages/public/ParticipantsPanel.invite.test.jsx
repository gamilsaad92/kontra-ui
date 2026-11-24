jest.mock('../../lib/supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

jest.mock('../../lib/workflowPacks', () => ({
  DEFAULT_PACK_ID: 'test_pack',
  getWorkflowPack: () => ({
    name: 'Test pack',
    roles: [
      { key: 'owner', label: 'Owner', canManage: true },
      { key: 'buyer', label: 'Buyer' },
    ],
  }),
}));

jest.mock('../../lib/workflowRoles', () => ({
  getCoordinatorRoleKeys: () => ['owner'],
  getExternalParticipantRoles: () => [{ key: 'buyer', label: 'Buyer', icon: '👤' }],
  isCoordinatorRole: role => role.key === 'owner',
  resolveCoordinatorRole: () => ({ key: 'owner', label: 'Owner', icon: '🏢' }),
}));

jest.mock('../../lib/inviteUtils', () => ({
  buildInviteLink: jest.fn(),
  createInvite: jest.fn(),
  getRoomAuthHeaders: jest.fn(() => ({})),
  revokeInvite: jest.fn(),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ParticipantsPanel, { InviteModal } from './ParticipantsPanel';

const roles = [{ key: 'seller', label: 'Seller', icon: '🏪' }];

describe('participant invitation modal delivery reporting', () => {
  it('does not claim an email was sent when delivery failed and offers the transient link', async () => {
    const onSend = jest.fn().mockResolvedValue({
      emailSent: false,
      deliveryReason: 'email_send_failed',
      inviteUrl: 'https://staging.example.test/deal-room/room-1?invite=transient-secret&role=seller',
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });

    render(
      <InviteModal
        open
        onClose={jest.fn()}
        prefilledRoleKey="seller"
        roles={roles}
        isV2={false}
        onSend={onSend}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('participant@firm.com'), {
      target: { value: 'seller@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));

    await screen.findByText('Invitation created');
    expect(screen.getByText(/did not send an email/)).toBeTruthy();
    expect(screen.getByText(/Email delivery failed/)).toBeTruthy();
    expect(screen.queryByText(/Kontra sent the invite email/)).toBeNull();
    expect(screen.getByLabelText('New invitation link').value).toContain('transient-secret');

    fireEvent.click(screen.getByRole('button', { name: 'Copy invitation link' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://staging.example.test/deal-room/room-1?invite=transient-secret&role=seller',
    );
    expect(screen.getByText(/does not verify email identity/)).toBeTruthy();
  });

  it('shows successful delivery only when the API confirms it', async () => {
    const onSend = jest.fn().mockResolvedValue({
      emailSent: true,
      inviteUrl: 'https://staging.example.test/deal-room/room-1?invite=token&role=seller',
    });
    render(
      <InviteModal
        open
        onClose={jest.fn()}
        prefilledRoleKey="seller"
        roles={roles}
        isV2
        onSend={onSend}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('participant@firm.com'), {
      target: { value: 'seller@example.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));

    expect(await screen.findByText(/Kontra sent the invite email/)).toBeTruthy();
    expect(screen.queryByText(/did not send an email/)).toBeNull();
  });
});

describe('participant panel menu and invitation timestamps', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the participant action menu visible and labels invite creation accurately', async () => {
    const priorFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        invites: [{
          id: 'invite-1',
          role_key: 'buyer',
          invited_email: 'buyer@example.test',
          status: 'pending',
          created_at: new Date().toISOString(),
          last_used_at: null,
        }],
      }),
    });

    try {
      render(<ParticipantsPanel roomId="room-1" packId="test_pack" isCoordinator />);
      await screen.findByText('Invited');
      expect(screen.getByText('Created just now')).toBeTruthy();
      expect(screen.queryByText('Sent just now')).toBeNull();

      const panel = screen.getByText('Participants').closest('div.bg-white');
      expect(panel.className).toContain('overflow-visible');
      expect(panel.className).not.toContain('overflow-hidden');

      fireEvent.click(screen.getByRole('button', { name: 'Participant actions for Buyer' }));
      expect(await screen.findByText(/Send another invitation/)).toBeTruthy();
    } finally {
      global.fetch = priorFetch;
    }
  });
});
