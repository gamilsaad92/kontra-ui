jest.mock('../../lib/supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: false,
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InviteModal } from './ParticipantsPanel';

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
